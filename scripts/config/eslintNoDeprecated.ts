/**
 * Copied from https://github.com/cartant/eslint-plugin-etc/blob/main/source/rules/no-deprecated.ts
 * due to lack of updates for new dependency versions.
 *
 * License for original code:
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/eslint-plugin-etc
 */
import { ESLintUtils } from '@typescript-eslint/utils';
import ts from 'typescript';
import { tsquery } from '@phenomnomnominal/tsquery';
import * as tsutils from 'tsutils';

const createRule = ESLintUtils.RuleCreator(_name => '');

const deprecatedNamesByProgram = new WeakMap<ts.Program, Set<string>>();

export default createRule({
  name: 'no-deprecated',
  defaultOptions: [],
  meta: {
    docs: {
      description: 'Forbids the use of deprecated APIs.',
    },
    messages: {
      forbidden: `"{{name}}" is deprecated: {{comment}}`,
    },
    schema: [],
    type: 'problem',
  },
  create: context => {
    const { esTreeNodeToTSNodeMap, program } = ESLintUtils.getParserServices(context);
    const typeChecker = program.getTypeChecker();

    let deprecatedNames = deprecatedNamesByProgram.get(program);
    if (!deprecatedNames) {
      deprecatedNames = findTaggedNames('deprecated', program);
      deprecatedNamesByProgram.set(program, deprecatedNames);
    }

    return {
      Identifier: node => {
        const parentType = node.parent?.type;
        if (
          parentType === 'ExportSpecifier' ||
          parentType === 'ImportDefaultSpecifier' ||
          parentType === 'ImportNamespaceSpecifier' ||
          parentType === 'ImportSpecifier'
        ) {
          return;
        }
        const identifier = esTreeNodeToTSNodeMap.get(node) as ts.Identifier;
        if (!deprecatedNames.has(identifier.text) || isDeclaration(identifier)) {
          return;
        }

        const tags = getTags('deprecated', identifier, typeChecker) || [];
        for (const tag of tags) {
          context.report({
            data: {
              comment: tag.trim().replace(/\s+/g, ' '),
              name: identifier.text,
            },
            messageId: 'forbidden',
            node,
          });
        }
      },
    };
  },
});

function isDeclaration(identifier: ts.Identifier): boolean {
  const parent = identifier.parent;
  switch (parent.kind) {
    case ts.SyntaxKind.ClassDeclaration:
    case ts.SyntaxKind.ClassExpression:
    case ts.SyntaxKind.InterfaceDeclaration:
    case ts.SyntaxKind.TypeParameter:
    case ts.SyntaxKind.FunctionExpression:
    case ts.SyntaxKind.FunctionDeclaration:
    case ts.SyntaxKind.LabeledStatement:
    case ts.SyntaxKind.JsxAttribute:
    case ts.SyntaxKind.MethodDeclaration:
    case ts.SyntaxKind.MethodSignature:
    case ts.SyntaxKind.PropertySignature:
    case ts.SyntaxKind.TypeAliasDeclaration:
    case ts.SyntaxKind.GetAccessor:
    case ts.SyntaxKind.SetAccessor:
    case ts.SyntaxKind.EnumDeclaration:
    case ts.SyntaxKind.ModuleDeclaration:
      return true;
    case ts.SyntaxKind.VariableDeclaration:
    case ts.SyntaxKind.Parameter:
    case ts.SyntaxKind.PropertyDeclaration:
    case ts.SyntaxKind.EnumMember:
    case ts.SyntaxKind.ImportEqualsDeclaration:
      return (parent as ts.NamedDeclaration).name === identifier;
    case ts.SyntaxKind.PropertyAssignment:
      return (
        (parent as ts.PropertyAssignment).name === identifier &&
        !tsutils.isReassignmentTarget(identifier.parent.parent as ts.ObjectLiteralExpression)
      );
    case ts.SyntaxKind.BindingElement:
      // return true for `b` in `const {a: b} = obj"`
      return (
        (parent as ts.BindingElement).name === identifier && (parent as ts.BindingElement).propertyName !== undefined
      );
    default:
      return false;
  }
}

/**
 * Get all identifiers with jsdoc tag `@tagName` in the program.
 */
function findTaggedNames(tagName: string, program: ts.Program): Set<string> {
  const taggedNames = new Set<string>();
  for (const sourceFile of program.getSourceFiles()) {
    if (!sourceFile.text.includes(`@${tagName}`)) {
      continue;
    }
    const nodes = tsquery(
      sourceFile,
      `ClassDeclaration, Constructor, EnumDeclaration, EnumMember, FunctionDeclaration, GetAccessor, ` +
        `InterfaceDeclaration, MethodDeclaration, MethodSignature, PropertyDeclaration, PropertySignature, ` +
        `SetAccessor, TypeAliasDeclaration, VariableDeclaration`
    );
    for (const node of nodes) {
      const tags = ts.getJSDocTags(node);
      if (tags.some(tag => tag.tagName.text === tagName)) {
        const name = ts.isConstructorDeclaration(node)
          ? node.parent.name
          : (node as ts.Node & { name?: ts.Identifier }).name;
        if (name?.text) {
          taggedNames.add(name.text);
        }
      }
    }
  }
  return taggedNames;
}

/**
 * Get the text of all tags of `node`'s type matching `tagName`.
 */
function getTags(tagName: string, node: ts.Identifier, tc: ts.TypeChecker): string[] {
  const callExpression = getCallExpresion(node);
  if (callExpression) {
    const signature = tc.getResolvedSignature(callExpression);
    const tags = signature && findTags(tagName, signature.getJsDocTags());
    if (tags?.length) {
      return tags;
    }
  }

  let symbol: ts.Symbol | undefined;
  const parent = node.parent;
  if (parent.kind === ts.SyntaxKind.BindingElement) {
    symbol = tc.getTypeAtLocation(parent.parent).getProperty(node.text);
  } else if (
    (tsutils.isPropertyAssignment(parent) && parent.name === node) ||
    (tsutils.isShorthandPropertyAssignment(parent) && parent.name === node && tsutils.isReassignmentTarget(node))
  ) {
    symbol = tc.getPropertySymbolOfDestructuringAssignment(node);
  } else {
    symbol = tc.getSymbolAtLocation(node);
  }

  if (symbol && tsutils.isSymbolFlagSet(symbol, ts.SymbolFlags.Alias)) {
    symbol = tc.getAliasedSymbol(symbol);
  }
  if (
    !symbol ||
    // if this is a CallExpression and the declaration is a function or method,
    // stop here to avoid collecting JsDoc of all overload signatures
    (callExpression && isFunctionOrMethod(symbol.declarations))
  ) {
    return [];
  }
  return findTags(tagName, symbol.getJsDocTags());
}

/**
 * Get the text of all `tags` matching `tagName`.
 */
function findTags(tagName: string, tags: ts.JSDocTagInfo[]): string[] {
  const result: string[] = [];
  for (const tag of tags) {
    if (tag.name === tagName) {
      const { text = '' } = tag;
      if (typeof text === 'string') {
        result.push(text);
      } else {
        result.push(text.reduce((text, part) => text + part.text, ''));
      }
    }
  }
  return result;
}

function getCallExpresion(node: ts.Expression): ts.CallLikeExpression | undefined {
  let parent = node.parent;
  if (tsutils.isPropertyAccessExpression(parent) && parent.name === node) {
    parent = parent.parent;
  }
  return tsutils.isCallLikeExpression(parent) ? parent : undefined;
}

function isFunctionOrMethod(declarations: ts.Declaration[] | undefined): boolean {
  if (!declarations?.length) {
    return false;
  }
  switch (declarations[0].kind) {
    case ts.SyntaxKind.MethodDeclaration:
    case ts.SyntaxKind.FunctionDeclaration:
    case ts.SyntaxKind.FunctionExpression:
    case ts.SyntaxKind.MethodSignature:
      return true;
    default:
      return false;
  }
}

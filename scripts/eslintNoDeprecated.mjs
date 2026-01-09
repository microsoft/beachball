// @ts-check
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

const createRule = ESLintUtils.RuleCreator(name => '');

/** @type {WeakMap<ts.Program, Set<string>>} */
const deprecatedNamesByProgram = new WeakMap();

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
    let /** @type {ts.Node[] | undefined } */ ignoredNodes;

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
        const identifier = /** @type {ts.Identifier} */ (esTreeNodeToTSNodeMap.get(node));
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

function isDeclaration(/** @type {ts.Identifier} */ identifier) {
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
      return /** @type {ts.NamedDeclaration} */ (parent).name === identifier;
    case ts.SyntaxKind.PropertyAssignment:
      return (
        /** @type {ts.PropertyAssignment} */ (parent).name === identifier &&
        !tsutils.isReassignmentTarget(/** @type {ts.ObjectLiteralExpression} */ (identifier.parent.parent))
      );
    case ts.SyntaxKind.BindingElement:
      // return true for `b` in `const {a: b} = obj"`
      return (
        /** @type {ts.BindingElement} */ (parent).name === identifier &&
        /** @type {ts.BindingElement} */ (parent).propertyName !== undefined
      );
    default:
      return false;
  }
}

/**
 * Get all identifiers with jsdoc tag `@tagName` in the program.
 * @param {string} tagName
 * @param {ts.Program} program
 */
function findTaggedNames(tagName, program) {
  const /** @type {Set<string>} */ taggedNames = new Set();
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
          : /** @type {ts.Node & { name?: ts.Identifier }} */ (node).name;
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
 * @param {string} tagName
 * @param {ts.Identifier} node
 * @param {ts.TypeChecker} tc
 */
function getTags(tagName, node, tc) {
  const callExpression = getCallExpresion(node);
  if (callExpression) {
    const signature = tc.getResolvedSignature(callExpression);
    const tags = signature && findTags(tagName, signature.getJsDocTags());
    if (tags?.length) {
      return tags;
    }
  }

  let /** @type {ts.Symbol | undefined} */ symbol;
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
 * @param {string} tagName
 * @param {ts.JSDocTagInfo[]} tags
 */
function findTags(tagName, tags) {
  const result = /** @type {string[]} */ ([]);
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

function getCallExpresion(/** @type {ts.Expression} */ node) {
  let parent = node.parent;
  if (tsutils.isPropertyAccessExpression(parent) && parent.name === node) {
    parent = parent.parent;
  }
  return tsutils.isCallLikeExpression(parent) ? parent : undefined;
}

function isFunctionOrMethod(/** @type {ts.Declaration[] | undefined} */ declarations) {
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

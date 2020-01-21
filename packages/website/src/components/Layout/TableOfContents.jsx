import React from 'react'
import Link from 'gatsby-link'
import styled from 'styled-components'

import tw from 'tailwind.macro'

/* eslint react/no-array-index-key: "off" */

const Links = ({ entries }) => (
  <StyledLinkList>
    {entries.map(({ entry }, key) => (
      <EntryListItem key={key}>
        <Link to={entry.childMarkdownRemark.fields.slug}>
          <EntryTitle>{entry.childMarkdownRemark.frontmatter.title}</EntryTitle>
        </Link>
      </EntryListItem>
    ))}
  </StyledLinkList>
)

const ChapterList = ({ chapters, entries, title, level = 0 }) => (
  <StyledChapterList>
    {title && (
      <ChapterListItem key={`${title}${level}`}>
        <ChapterTitle level={level}>{title}</ChapterTitle>
      </ChapterListItem>
    )}
    <ChapterListItem>{entries && <Links entries={entries} />}</ChapterListItem>
    <ChapterListItem>
      {chapters &&
        chapters.map((chapter, index) => (
          <ChapterList {...chapter} level={level + 1} key={`${index}`} />
        ))}
    </ChapterListItem>
  </StyledChapterList>
)

const TableOfContents = ({ chapters }) => (
  <TOCWrapper>
    {chapters.map((chapter, index) => (
      <ChapterList {...chapter} key={index} />
    ))}
  </TOCWrapper>
)

export default TableOfContents

const TOCWrapper = tw.div`m-0 py-8`

const StyledChapterList = tw.ol`list-none m-0`

const StyledLinkList = tw.ol`list-none m-0`

const EntryTitle = tw.h6`font-light  m-0`

const ChapterListItem = tw.li`m-0 mb-2`

const EntryListItem = tw.li`m-0 mb-2 hover:border-b `

const ChapterTitle = tw.h5`text-lg my-3 text-blue-500`

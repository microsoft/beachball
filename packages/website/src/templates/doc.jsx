import { graphql } from 'gatsby'

import React from 'react'
import Helmet from 'react-helmet'
import styled from 'styled-components'

import SEO from '../components/SEO'
import SiteHeader from '../components/Layout/Header'
import config from '../../data/SiteConfig'
import TableOfContents from '../components/Layout/TableOfContents'
import Layout from '../layouts'

import tw from 'tailwind.macro'

export default class DocTemplate extends React.Component {
  render() {
    const { slug } = this.props.pathContext
    const postNode = this.props.data.postBySlug
    const post = postNode.frontmatter
    if (!post.id) {
      post.id = slug
    }
    if (!post.id) {
      post.category_id = config.postDefaultCategoryID
    }
    return (
      <Layout location={this.props.location}>
        <div>
          <Helmet>
            <title>{`${post.title} | ${config.siteTitle}`}</title>
          </Helmet>
          <SEO postPath={slug} postNode={postNode} postSEO />
          <HeaderContainer>
            <SiteHeader location={this.props.location} />
          </HeaderContainer>
          <ContentContainer className="container">
            <ToCContainer>
              <TableOfContents
                chapters={this.props.data.tableOfContents.chapters}
              />
            </ToCContainer>
            <BodyContainer>
              <div className="mdContent">
                <h1>{post.title}</h1>
                <div dangerouslySetInnerHTML={{ __html: postNode.html }} />
              </div>
            </BodyContainer>
          </ContentContainer>
        </div>
      </Layout>
    )
  }
}

const ContentContainer = tw.div`mx-auto flex pt-8`

const BodyContainer = tw.div`w-4/5 p-8`

const HeaderContainer = tw.div``

const ToCContainer = tw.div`w-1/5`

/* eslint no-undef: "off" */
export const pageQuery = graphql`
  query DocBySlug($slug: String!) {
    postBySlug: markdownRemark(fields: { slug: { eq: $slug } }) {
      html
      frontmatter {
        title
      }
    }
    tableOfContents: docsJson {
      chapters {
        title
        entries {
          entry {
            id
            childMarkdownRemark {
              fields {
                slug
              }
              frontmatter {
                title
              }
            }
          }
        }
      }
    }
  }
`

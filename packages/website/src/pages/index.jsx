import { graphql } from 'gatsby'
import React from 'react'
import Helmet from 'react-helmet'
import styled from 'styled-components'

import config from '../../data/SiteConfig'
import CtaButton from '../components/CtaButton'
import Navigation from '../components/Layout/Navigation'

import Layout from '../layouts'

import beachBallSvg from '../assets/beach-ball.svg'

class Index extends React.Component {
  render() {
    //const allSEOMarkdown = this.props.data.allMarkdown.edges

    return (
      <Layout location={this.props.location}>
        <div className="index-container">
          <Helmet title={config.siteTitle} />
          <main>
            <IndexHeadContainer>
              <Navigation />
              <Hero>
                <LogoRow>
                  <BeachBallLogo src={beachBallSvg} />
                  <h1>{config.siteTitle}</h1>
                </LogoRow>
                <h4>{config.siteDescription}</h4>
              </Hero>
            </IndexHeadContainer>
            <BodyContainer>
              <CtaButton to={'/getting-started'}>Getting Started</CtaButton>

              <div className="contributors">
                <div>
                  Icons made by{' '}
                  <a href="https://www.freepik.com/" title="Freepik">
                    Freepik
                  </a>{' '}
                  from{' '}
                  <a href="https://www.flaticon.com/" title="Flaticon">
                    www.flaticon.com
                  </a>{' '}
                  is licensed by{' '}
                  <a
                    href="http://creativecommons.org/licenses/by/3.0/"
                    title="Creative Commons BY 3.0"
                    target="_blank"
                  >
                    CC 3.0 BY
                  </a>
                </div>
              </div>
            </BodyContainer>
          </main>
        </div>
      </Layout>
    )
  }
}

export default Index

const LogoRow = styled.div`
  display: flex;
  margin: 0 auto;
  align-items: center;
  justify-content: center;
`

const BeachBallLogo = styled.img`
  height: 40px;
  width: 40px;
  margin-right: 5px;
`

const IndexHeadContainer = styled.div`
  background: ${props => props.theme.brand};
  padding: ${props => props.theme.sitePadding};
  text-align: center;
`

const Hero = styled.div`
  padding: 50px 0;
  & h1 {
    font-weight: 600;
    margin: 0;
    padding: 0;
    line-height: 60px;
  }
`

const BodyContainer = styled.div`
  padding: ${props => props.theme.sitePadding};
  max-width: ${props => props.theme.contentWidthLaptop};
  margin: 0 auto;

  .contributors {
    margin: 100px auto 0;
  }
  .contributors a {
    font-size: 1rem;
  }
`

/* eslint no-undef: "off" */
export const query = graphql`
  query IndexQuery {
    allMarkdown: allMarkdownRemark(limit: 2000) {
      edges {
        node {
          fields {
            slug
          }
          excerpt
          frontmatter {
            title
          }
        }
      }
    }
  }
`

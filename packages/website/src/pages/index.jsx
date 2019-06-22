import { graphql } from 'gatsby'
import React from 'react'
import Helmet from 'react-helmet'
import styled from 'styled-components'

import config from '../../data/SiteConfig'
import CtaButton from '../components/CtaButton'
import Navigation from '../components/Layout/Navigation'

import Layout from '../layouts'

import beachBallSvg from '../assets/beach-ball.svg'
import Footer from '../components/Layout/Footer'

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
                <CtaButton to={'/getting-started'}>Getting Started</CtaButton>
              </Hero>
            </IndexHeadContainer>
            <BodyContainer>
              <FeatureRow>
                <Feature>
                  <h3>Synchronized in git and npm</h3>
                  keep your git and npm versions in sync in CI and local
                  workflows
                </Feature>
                <Feature>
                  <h3>Automated Version Bumps</h3>
                  one command line to bump package(s) in your repo with semver
                </Feature>
                <Feature>
                  <h3>Generates Changelogs</h3>
                  same command will generate changelogs for your users
                </Feature>
              </FeatureRow>

              <FeatureRow>
                <Feature>
                  <h3>Single or Monorepo</h3>
                  compatible out of the box for single repo or lerna repos
                </Feature>
                <Feature>
                  <h3>Pre-Publish Validation Checks</h3>
                  double and triple check git repo and npm registry before
                  publish
                </Feature>
                <Feature>
                  <h3>Zero Config Versioning</h3>
                  no config is required to get started
                </Feature>
              </FeatureRow>
            </BodyContainer>
            <FooterContainer>
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
            </FooterContainer>
          </main>
        </div>
      </Layout>
    )
  }
}

export default Index

const FeatureRow = styled.div`
  display: flex;
  justify-content: stretch;
  margin-bottom: 40px;
`

const Feature = styled.div`
  flex: 1;
  font-size: 1.8rem;
  text-align: center;
`

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

const FooterContainer = styled.div`
  background: ${props => props.theme.lightGrey};

  bottom: 0;
  width: 100%;
  height: 100px; /* Height of the footer */
  padding-top: 30px;
  display: flex;
  justify-content: center;
  & a {
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

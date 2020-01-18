import '../utils/globals.css'

import { graphql } from 'gatsby'
import React from 'react'
import Helmet from 'react-helmet'
import styled from 'styled-components'
import {
  FaSync,
  FaRobot,
  FaNewspaper,
  FaCheckDouble,
  FaTerminal
} from 'react-icons/fa'
import { DiGitBranch } from 'react-icons/di'

import config from '../../data/SiteConfig'
import CtaButton from '../components/CtaButton'
import Navigation from '../components/Layout/Navigation'
import Layout from '../layouts'
import beachBallSvg from '../assets/beach-ball.svg'
import tw from 'tailwind.macro'

const Index = props => {
  return (
    <Layout location={props.location}>
      <IndexContainer>
        <Helmet title={config.siteTitle} />
        <Navigation />
        <IndexSection>
          <IndexHeadContainer className="container">
            <Hero className="font-hero">
              <LogoRow>
                <BeachBallLogo src={beachBallSvg} />
                <HeroText>{config.siteTitle}</HeroText>
              </LogoRow>
              <HeroSubText>{config.siteDescription}</HeroSubText>
              <CtaButton to={'/getting-started'}>Getting Started</CtaButton>
            </Hero>
          </IndexHeadContainer>
        </IndexSection>
        <BodyContainer>
          <FeatureRow>
            <Feature>
              <FaSync size="3rem" />
              <h4>Synchronized in git and npm</h4>
              keep your git and npm versions in sync in CI and local workflows
            </Feature>
            <Feature>
              <FaRobot size="3rem" />
              <h4>Automated Version Bumps</h4>
              one command line to bump package(s) in your repo with semver
            </Feature>
          </FeatureRow>

          <FeatureRow>
            <Feature>
              <FaNewspaper size="3rem" />
              <h4>Generates Changelogs</h4>
              same command will generate changelogs for your users
            </Feature>
            <Feature>
              <DiGitBranch size="3rem" />
              <h4>Single or Monorepo</h4>
              compatible out of the box for single repo or monorepos
            </Feature>
          </FeatureRow>
          <FeatureRow>
            <Feature>
              <FaCheckDouble size="3rem" />
              <h4>Pre-Publish Validation Checks</h4>
              double and triple check git repo and npm registry before publish
            </Feature>
            <Feature>
              <FaTerminal size="3rem" />
              <h4>Zero Config Versioning</h4>
              no config is required to get started, do more in one line
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
      </IndexContainer>
    </Layout>
  )
}

export default Index

const IndexContainer = styled('div')``

const FeatureRow = styled.div`
  display: flex;
  justify-content: stretch;
  margin: 40px 0;
`

const Feature = styled.div`
  flex: 1;
  font-size: 1.4rem;

  margin: 0;
  padding: 0;

  & h4 {
    margin: 0;
  }

  &:first-child {
    margin-right: 25px;
  }
`

const LogoRow = tw.div`flex justify-center mb-4`

const BeachBallLogo = styled.img`
  height: 40px;
  width: 40px;
  ${tw`mr-5 self-center`}
`

const IndexSection = tw.div`mx-auto bg-yellow-400`

const IndexHeadContainer = tw.div`mx-auto bg-yellow-400 text-center`

const Hero = styled.div`
  min-height: 500px;
  ${tw`mx-auto flex flex-col justify-center`};
`

const HeroText = tw.h1`font-bold text-4xl`

const HeroSubText = tw.h4`text-2xl mb-4`

const BodyContainer = styled.div`
  padding: ${props => props.theme.sitePadding};
  max-width: ${props => props.theme.contentWidthLaptop};
  margin: 0 auto;

  flex-grow: 1;

  .contributors {
    margin: 100px auto 0;
  }

  .contributors a {
    font-size: 1rem;
  }

  margin-bottom: 100px;
`

const FooterContainer = styled.footer`
  background: ${props => props.theme.lightGrey};

  height: 100px;

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
    allMarkdown: allMarkdownRemark(
      limit: 2000
      sort: { order: ASC, fields: [fields___slug] }
    ) {
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

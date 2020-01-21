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
        <BodyContainer className="container">
          <FeatureList className="grid grid-automin-300px">
            <Feature>
              <FeatureHeader>
                <FaSync size="2rem" className="mr-2" />
                <h4>Synchronized in git and npm</h4>
              </FeatureHeader>
              <FeatureDesc>
                keep your git and npm versions in sync in CI and local workflows
              </FeatureDesc>
            </Feature>
            <Feature>
              <FeatureHeader>
                <FaRobot size="2rem" className="mr-2" />
                <h4>Automated Version Bumps</h4>
              </FeatureHeader>
              <FeatureDesc>
                one command line to bump package(s) in your repo with semver
              </FeatureDesc>
            </Feature>
            <Feature>
              <FeatureHeader>
                <FaNewspaper size="2rem" className="mr-2" />
                <h4>Generates Changelogs</h4>
              </FeatureHeader>
              <FeatureDesc>
                same command will generate changelogs for your users
              </FeatureDesc>
            </Feature>
            <Feature>
              <FeatureHeader>
                <DiGitBranch size="2rem" className="mr-2" />
                <h4>Single or Monorepo</h4>
              </FeatureHeader>
              <FeatureDesc>
                compatible out of the box for single repo or monorepos
              </FeatureDesc>
            </Feature>
            <Feature>
              <FeatureHeader>
                <FaCheckDouble size="2rem" className="mr-2" />
                <h4>Pre-Publish Validation Checks</h4>
              </FeatureHeader>
              <FeatureDesc>
                double and triple check git repo and npm registry before publish
              </FeatureDesc>
            </Feature>
            <Feature>
              <FeatureHeader>
                <FaTerminal size="2rem" className="mr-2" />
                <h4>Zero Config Versioning</h4>
              </FeatureHeader>
              <FeatureDesc>
                no config is required to get started, do more in one line
              </FeatureDesc>
            </Feature>
          </FeatureList>
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

const FeatureList = tw.div`w-3/4 grid grid-automin-300px grid-gap-4 mt-4 mx-auto`

const FeatureHeader = tw.div`flex text-lg font-black items-center mb-4`

const Feature = tw.div`text-base font-light mb-8`

const FeatureDesc = tw.div`col-span-2`

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

const BodyContainer = tw.div`mx-auto mt-8`

const FooterContainer = tw.footer`bg-gray-300 text-xs h-16 text-center pt-4`

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

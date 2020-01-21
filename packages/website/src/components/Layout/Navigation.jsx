import React from 'react'
import Link from 'gatsby-link'
import styled from 'styled-components'
import UserLinks from '../UserLinks'
import tw from 'tailwind.macro'

const NavContainer = tw.div`bg-gray-200 w-full shadow`
const NavContent = tw.div`mx-auto flex justify-between h-10 items-center`
const StyledLink = tw(Link)`mr-5`

class Navigation extends React.Component {
  render() {
    return (
      <NavContainer>
        <NavContent className="container">
          <section>
            <StyledLink to="/">BEACHBALL</StyledLink>
            <StyledLink to="/getting-started">DOCS</StyledLink>
          </section>
          <span>
            <UserLinks />
          </span>
        </NavContent>
      </NavContainer>
    )
  }
}

export default Navigation

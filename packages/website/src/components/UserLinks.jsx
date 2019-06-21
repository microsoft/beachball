import React, { Component } from 'react'
import { FaGithubAlt } from 'react-icons/fa'
import siteConfig from '../../data/SiteConfig'
import styled from 'styled-components'

const Container = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  max-width: 100%;
`

const UserIcon = styled.a`
  margin-left: 25px;
  color: ${props => props.theme.ink};
  &:hover {
    color: rgba(0, 0, 0, 0.2);
    border-bottom: none;
  }
`

const iconStyle = {
  width: '20px',
  height: '20px'
}

class UserLinks extends Component {
  render() {
    return (
      <Container className="user-links">
        <UserIcon href={siteConfig.repoLink}>
          <FaGithubAlt style={iconStyle} />
        </UserIcon>
      </Container>
    )
  }
}

export default UserLinks

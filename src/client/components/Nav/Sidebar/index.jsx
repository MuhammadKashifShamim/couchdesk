/*
 *       .                             .o8                     oooo
 *    .o8                             "888                     `888
 *  .o888oo oooo d8b oooo  oooo   .oooo888   .ooooo.   .oooo.o  888  oooo
 *    888   `888""8P `888  `888  d88' `888  d88' `88b d88(  "8  888 .8P'
 *    888    888      888   888  888   888  888ooo888 `"Y88b.   888888.
 *    888 .  888      888   888  888   888  888    .o o.  )88b  888 `88b.
 *    "888" d888b     `V88V"V8P' `Y8bod88P" `Y8bod8P' 8""888P' o888o o888o
 *  ========================================================================
 *  Author:     Chris Brame
 *  Updated:    1/20/19 4:46 PM
 *  Copyright (c) 2014-2019. All rights reserved.
 */

import React from 'react'
import { connect } from 'react-redux'
import PropTypes from 'prop-types'
import SidebarItem from 'components/Nav/SidebarItem'
import NavSeparator from 'components/Nav/NavSeperator'
import Submenu from 'components/Nav/Submenu'
import SubmenuItem from 'components/Nav/SubmenuItem'

import { updateNavChange } from '../../../actions/nav'

import Helpers from 'lib/helpers'

class Sidebar extends React.Component {
  constructor(props) {
    super(props)
  }

  componentDidMount() {
    Helpers.UI.getPlugins((err, result) => {
      if (!err && result.plugins) {
        this.setState({ plugins: result.plugins })
      }
    })
  }

  componentDidUpdate() {
    Helpers.UI.initSidebar()
    Helpers.UI.bindExpand()
  }

  renderPlugins() {
    const { plugins, sessionUser, activeItem, activeSubItem } = this.state
    return (
      <SidebarItem
        text='Plugins'
        icon='extension'
        href='/plugins'
        class='navPlugins tether-plugins'
        hasSubmenu={plugins && plugins.length > 0}
        subMenuTarget='plugins'
        active={activeItem === 'plugins'}
      >
        {plugins && plugins.length > 0 && (
          <Submenu id='plugins' subMenuOpen={activeItem === 'plugins'}>
            {plugins.map(function (item) {
              const perms = item.permissions.split(' ')
              if (perms.indexOf(sessionUser.role) === -1) return
              return (
                <SubmenuItem
                  key={item.name}
                  text={item.menu.main.name}
                  icon={item.menu.main.icon}
                  href={item.menu.main.link}
                  active={activeSubItem === item.name}
                />
              )
            })}
          </Submenu>
        )}
      </SidebarItem>
    )
  }

  render() {
    const { activeItem, activeSubItem, sessionUser } = this.props
    return (
      <ul className='side-nav'>
        {/* sessionUser && Helpers.canUser('agent:*', true) && (
          <SidebarItem
            text='Dashboard'
            icon='dashboard'
            href='/dashboard'
            class='navHome'
            active={activeItem === 'dashboard'}
          />
        ) */}
        {sessionUser && Helpers.canUser('tickets:view') && (
          <>
            <SidebarItem
              text='Live Tickets'
              icon='chair'
              href='/tickets/live'
              active={activeItem === 'tickets-live'}
            />
            {(sessionUser.role.isAdmin || sessionUser.role.isAgent) ? (
              <>
                <SidebarItem
                  text='Next Tickets'
                  icon='collections_bookmark'
                  href='/tickets/upcoming'
                  active={activeItem === 'tickets-upcoming'}
                />
                <NavSeparator />
                <SidebarItem
                  text='New Tickets'
                  icon='move_to_inbox'
                  href='/tickets/new'
                  active={activeItem === 'tickets-new'}
                />
                <NavSeparator />
                {Helpers.canUser('tickets:update') && (
                  <SidebarItem
                    text='Delegated Tickets'
                    icon='folder_shared'
                    href='/tickets/delegated'
                    active={activeItem === 'tickets-delegated'}
                  />
                )}
                {Helpers.canUser('tickets:update') && (
                  <SidebarItem
                    text='Unassigned Tickets'
                    icon='person_off'
                    href='/tickets/unassigned'
                    active={activeItem === 'tickets-unassigned'}
                  />
                )}
                <NavSeparator />
                <SidebarItem
                  text='Tickets'
                  icon='assignment'
                  href='/tickets/new'
                  class='navTickets no-ajaxy'
                  hasSubmenu={true}
                  subMenuTarget='tickets'
                  active={activeItem === 'tickets'}
                >
                  <Submenu id='tickets'>
                    {/* <SubmenuItem
                      text='Mine'
                      icon='assignment_ind'
                      href='/tickets/assigned'
                      active={activeSubItem === 'tickets-assigned'}
                    />
                    <NavSeparator /> */}
                    <SubmenuItem
                      text='Working'
                      icon='sensors'
                      href='/tickets/working'
                      active={activeSubItem === 'tickets-working'}
                    />
                    <SubmenuItem
                      text='Active'
                      icon='source'
                      href='/tickets/active'
                      active={activeSubItem === 'tickets-active'}
                    />
                    <SubmenuItem
                      text='Pending'
                      icon='pending'
                      href='/tickets/pending'
                      active={activeSubItem === 'tickets-pending'}
                    />
                    <SubmenuItem
                      text='Open'
                      icon='&#xE2C8;'
                      href='/tickets/open'
                      active={activeSubItem === 'tickets-open'}
                    />
                    <SubmenuItem
                      text='Done'
                      icon='assignment_turned_in'
                      href='/tickets/done'
                      active={activeSubItem === 'tickets-done'}
                    />
                    {Helpers.canUser('tickets:closing', true) && (
                      <SubmenuItem
                        text='Hold'
                        icon='hourglass_top'
                        href='/tickets/hold'
                        active={activeSubItem === 'tickets-hold'}
                      />
                    )}
                    {Helpers.canUser('tickets:closing', true) && (
                      <SubmenuItem
                        text='Closed'
                        icon='&#xE2C7;'
                        href='/tickets/closed'
                        active={activeSubItem === 'tickets-closed'}
                      />
                    )}
                  </Submenu>
                </SidebarItem>
              </>
            ) : (
              <>
                <SidebarItem
                  text='All Tickets'
                  icon='source'
                  href='/tickets/active'
                  active={activeItem === 'tickets-active'}
                />
                <SidebarItem
                  text='Unfinished Tickets'
                  icon='&#xE2C8;'
                  href='/tickets/open'
                  active={activeItem === 'tickets-open'}
                />
                <SidebarItem
                  text='Completed Tickets'
                  icon='assignment_turned_in'
                  href='/tickets/done'
                  active={activeItem === 'tickets-done'}
                />
              </>
            )}
          </>
        )}
        {sessionUser && (sessionUser.role.isAdmin || sessionUser.role.isAgent || Helpers.canUser('accounts:chat')) && (
          <SidebarItem
            text='Messages'
            icon='chat'
            href='/messages'
            class='navMessages'
            active={activeItem === 'messages'}
          />
        )}
        {sessionUser && Helpers.canUser('accounts:view') && (
          <SidebarItem
            text='Accounts'
            icon='&#xE7FD;'
            href='/accounts'
            class='navAccounts'
            active={activeItem === 'accounts'}
            subMenuTarget='accounts'
            hasSubmenu={sessionUser && Helpers.canUser('agent:*', true)}
          >
            {sessionUser && Helpers.canUser('agent:*', true) && (
              <Submenu id='accounts'>
                <SubmenuItem
                  href={'/accounts/customers'}
                  text={'Users'}
                  icon={'portrait'}
                  active={activeSubItem === 'accounts-customers'}
                />
                {sessionUser && Helpers.canUser('agent:*', true) && (
                  <SubmenuItem
                    href={'/accounts/agents'}
                    text={'Agents'}
                    icon={'support_agent'}
                    active={activeSubItem === 'accounts-agents'}
                  />
                )}
                {sessionUser && Helpers.canUser('admin:*') && (
                  <SubmenuItem
                    href={'/accounts/admins'}
                    text={'Admins'}
                    icon={'manage_accounts'}
                    active={activeSubItem === 'accounts-admins'}
                  />
                )}
              </Submenu>
            )}
          </SidebarItem>
        )}
        {sessionUser && (Helpers.canUser('groups:view') || Helpers.canUser('teams:view') || Helpers.canUser('departments:view') || Helpers.canUser('notices:view')) && (
          <SidebarItem
            text='Company'
            icon='maps_home_work'
            href='/groups'
            class='navCompany no-ajaxy'
            hasSubmenu={true}
            subMenuTarget='company'
            active={activeItem === 'company'}
          >
            <Submenu id='company'>
              {Helpers.canUser('groups:view') && (
                <SubmenuItem
                  text='Projects'
                  icon='cases'
                  href='/groups'
                  active={activeSubItem === 'company-groups'}
                />
              )}
              {Helpers.canUser('teams:view') && (
                <SubmenuItem
                  text='Teams'
                  icon='wc'
                  href='/teams'
                  active={activeSubItem === 'company-teams'}
                />
              )}
              {Helpers.canUser('departments:view') && (
                <SubmenuItem
                  text='Departments'
                  icon='domain'
                  href='/departments'
                  active={activeSubItem === 'company-departments'}
                />
              )}
              {Helpers.canUser('notices:view') && (
                <SubmenuItem
                  text='Notices'
                  icon='warning'
                  href='/notices'
                  active={activeSubItem === 'company-notices'}
                />
              )}
            </Submenu>
          </SidebarItem>
        )}
        {sessionUser && Helpers.canUser('reports:view') && (
          <SidebarItem
            text='Reports'
            icon='assessment'
            href='/reports/generate'
            class='navReports no-ajaxy'
            hasSubmenu={true}
            subMenuTarget='reports'
            active={activeItem === 'reports'}
          >
            <Submenu id='reports'>
              <SubmenuItem
                text='Generate'
                icon='timeline'
                href='/reports/generate'
                active={activeSubItem === 'reports-generate'}
              />
              <NavSeparator />
              <SubmenuItem
                text='Group Breakdown'
                icon='supervisor_account'
                href='/reports/breakdown/group'
                active={activeSubItem === 'reports-breakdown-group'}
              />
              <SubmenuItem
                text='User Breakdown'
                icon='perm_identity'
                href='/reports/breakdown/user'
                active={activeSubItem === 'reports-breakdown-user'}
              />
            </Submenu>
          </SidebarItem>
        )}

        {/*{this.renderPlugins()}*/}

        {sessionUser && Helpers.canUser('settings:edit') && (
          <SidebarItem
            text='Settings'
            icon='settings'
            href='/settings/general'
            class='navSettings no-ajaxy'
            hasSubmenu={true}
            subMenuTarget='settings'
            active={activeItem === 'settings'}
          >
            <Submenu id='settings'>
              <SubmenuItem text='General' icon='tune' href='/settings' active={activeSubItem === 'settings-general'} />
              <SubmenuItem
                text='Appearance'
                icon='style'
                href='/settings/appearance'
                active={activeSubItem === 'settings-appearance'}
              />
              <SubmenuItem
                text='Tickets'
                icon='assignment'
                href='/settings/tickets'
                active={activeSubItem === 'settings-tickets'}
              />
              <SubmenuItem
                text='Permissions'
                icon='security'
                href='/settings/permissions'
                active={activeSubItem === 'settings-permissions'}
              />
              <SubmenuItem
                text='Mailer'
                icon='email'
                href='/settings/mailer'
                active={activeSubItem === 'settings-mailer'}
              />
              {/*<SubmenuItem text="Notifications" icon="???" href="/settings/notifications" active={activeSubItem === 'settings-notifications'} />*/}
              <SubmenuItem
                href={'/settings/elasticsearch'}
                text={'Elasticsearch'}
                icon={'search'}
                active={activeSubItem === 'settings-elasticsearch'}
              />
              {/* <SubmenuItem
                text='Push Service'
                icon='mobile_friendly'
                href='/settings/tps'
                active={activeSubItem === 'settings-tps'}
              /> */}
              <SubmenuItem
                text='Backup/Restore'
                icon='archive'
                href='/settings/backup'
                active={activeSubItem === 'settings-backup'}
              />
              <SubmenuItem
                text='Legal'
                icon='gavel'
                href='/settings/legal'
                active={activeSubItem === 'settings-legal'}
              />
              {sessionUser && Helpers.canUser('settings:logs') && (
                <SubmenuItem
                  text='Logs'
                  icon='remove_from_queue'
                  href='/settings/logs'
                  hasSeperator={true}
                  active={activeSubItem === 'settings-logs'}
                />
              )}
            </Submenu>
          </SidebarItem>
        )}
        <NavSeparator />
        <SidebarItem href='/about' icon='help' text='About' active={activeItem === 'about'} />
        {/* <SidebarItem href={'https://www.trudesk.io'} icon={'cloud'} text={'Cloud'} target={'_blank'} /> */}
      </ul>
    )
  }
}

Sidebar.propTypes = {
  updateNavChange: PropTypes.func.isRequired,
  activeItem: PropTypes.string.isRequired,
  activeSubItem: PropTypes.string.isRequired,
  sessionUser: PropTypes.object,
  plugins: PropTypes.array
}

const mapStateToProps = state => ({
  activeItem: state.sidebar.activeItem,
  activeSubItem: state.sidebar.activeSubItem,
  sessionUser: state.shared.sessionUser
})

export default connect(
  mapStateToProps,
  { updateNavChange }
)(Sidebar)

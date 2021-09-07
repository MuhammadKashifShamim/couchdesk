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
 *  Updated:    2/10/19 3:06 AM
 *  Copyright (c) 2014-2019. All rights reserved.
 */

import React from 'react'
import PropTypes from 'prop-types'
import { connect } from 'react-redux'
import { observer } from 'mobx-react'
import { observable, when } from 'mobx'
import { head, orderBy } from 'lodash'
import axios from 'axios'
import Log from '../../logger'
import { createTicket } from 'actions/tickets'
import { fetchGroups } from 'actions/groups'
import { fetchAccountsCreateTicket } from 'actions/accounts'

import $ from 'jquery'
import helpers from 'lib/helpers'
import socket from 'lib/socket'

import BaseModal from 'containers/Modals/BaseModal'
import Grid from 'components/Grid'
import GridItem from 'components/Grid/GridItem'
import SingleSelect from 'components/SingleSelect'
import SpinLoader from 'components/SpinLoader'
import Button from 'components/Button'
import EasyMDE from 'components/EasyMDE'

@observer
class CreateTicketModal extends React.Component {
  @observable priorities = []
  // @observable allAccounts = this.props.accounts || []
  // @observable groupAccounts = []
  @observable selectedGroup = null
  @observable selectedPriority = ''
  issueText = ''

  constructor (props) {
    super(props)

    // FIXME: hack
    const filter = document.getElementById('tickets-container')
    this.filter = filter ? JSON.parse(filter.getAttribute('data-filter')) : {}
  }

  componentDidMount () {
    this.groupsWatcher = when(
      () => this.props.groups.size,
      () => {
        let groupId
        if (this.filter.groups && this.filter.groups.length > 0) {
          groupId = this.filter.groups[0]
        } else if (this.props.groups.size > 0) {
          groupId = this.props.groups.first().get('_id')
        }

        if (groupId) {
          this.selectedGroup = this.props.groups.find((group) => group.get('_id') === groupId) || null
        }
      }
    )

    this.props.fetchAccounts({ type: 'all:available', limit: -1 })
    this.props.fetchGroups()
    helpers.UI.inputs()
    helpers.formvalidator()
    this.defaultTicketTypeWatcher = when(
      () => this.props.viewdata.defaultTicketType,
      () => {
        this.priorities = orderBy(this.props.viewdata.defaultTicketType.priorities, ['migrationNum'])
        this.selectedPriority = head(this.priorities) ? head(this.priorities)._id : ''
      }
    )
  }

  componentDidUpdate () {}

  componentWillUnmount () {
    if (this.defaultTicketTypeWatcher) this.defaultTicketTypeWatcher()
    if (this.groupsWatcher) this.groupsWatcher()
  }

  onTicketTypeSelectChange (e) {
    if (!e.target.value) return

    this.priorityWrapper.classList.add('hide')
    this.priorityLoader.classList.remove('hide')
    axios
      .get(`/api/v1/tickets/type/${e.target.value}`)
      .then(res => {
        const type = res.data.type
        if (type && type.priorities) {
          this.priorities = orderBy(type.priorities, ['migrationNum'])
          this.selectedPriority = head(orderBy(type.priorities, ['migrationNum']))
            ? head(orderBy(type.priorities, ['migrationNum']))._id
            : ''

          setTimeout(() => {
            this.priorityLoader.classList.add('hide')
            this.priorityWrapper.classList.remove('hide')
          }, 500)
        }
      })
      .catch(error => {
        this.priorityLoader.classList.add('hide')
        Log.error(error)
        helpers.UI.showSnackbar(`Error: ${error.response.data.error}`)
      })
  }

  onPriorityRadioChange (e) {
    this.selectedPriority = e.target.value
  }

  onFormSubmit (e) {
    e.preventDefault()
    const $form = $(e.target)

    let data = {}
    // if (this.issueText.length < 1) return

    const minIssueLength = this.props.viewdata.ticketSettings.minIssue
    let $mdeError
    const $issueTextbox = $(this.issueMde.element)
    const $errorBorderWrap = $issueTextbox.parents('.error-border-wrap')
    if (this.issueText.length < minIssueLength) {
      $errorBorderWrap.css({ border: '1px solid #E74C3C' })
      const mdeError = $(
        `<div class="mde-error uk-float-left uk-text-left">Please enter a valid issue. Issue must contain at least ${minIssueLength} characters</div>`
      )
      $mdeError = $issueTextbox.siblings('.editor-statusbar').find('.mde-error')
      if ($mdeError.length < 1) $issueTextbox.siblings('.editor-statusbar').prepend(mdeError)

      return
    }

    $errorBorderWrap.css('border', 'none')
    $mdeError = $issueTextbox.parent().find('.mde-error')
    if ($mdeError.length > 0) $mdeError.remove()

    if (!$form.isValid(null, null, false)) return true
    if (!this.groupSelect.value) return true

    if (this.statusSelect) {
      data.status = this.statusSelect.value
    }

    if (this.isGrabbed) {
      data.assignee = this.props.shared.sessionUser._id
      data.status = 2
    } else if (this.assigneeSelect && this.assigneeSelect.value) {
      data.assignee = this.assigneeSelect.value
    }

    data.subject = e.target.subject.value
    data.owner = this.ownerSelect.value
    data.group = this.groupSelect.value
    data.type = this.typeSelect ? this.typeSelect.value : this.props.viewdata.defaultTicketType._id
    data.tags = this.tagSelect ? this.tagSelect.value : []
    data.priority = this.selectedPriority
    data.issue = this.issueMde.easymde.value()
    data.socketid = socket.ui.socket.io.engine.id
    data.public = this.publicSwitch ? this.publicSwitch.checked : true

    this.props.createTicket(data)
  }

  onGroupSelectChange (e) {
    // this.groupAccounts = this.props.groups
    //   .filter(grp => grp.get('_id') === e.target.value)
    //   .first()
    //   .get('members')
    //   .map(a => {
    //     return { text: a.get('fullname'), value: a.get('_id') }
    //   })
    //   .toArray()

    this.selectedGroup = this.props.groups.find((group) => group.get('_id') === e.target.value) || null
  }

  render () {
    const { shared, viewdata } = this.props

    const allowAgentUserTickets =
      viewdata.ticketSettings.allowAgentUserTickets &&
      (shared.sessionUser.role.isAdmin || shared.sessionUser.role.isAgent)

    const availableAccounts = this.selectedGroup ? this.props.accounts.filter((account) => this.selectedGroup.get('availableAccountIds').includes(account.get('_id'))) : this.props.accounts

    const mappedAccounts = availableAccounts
      .map(a => {
        return { text: a.get('fullname'), value: a.get('_id') }
      })
      .toArray()

    const mappedAgentAccounts = availableAccounts
      .filter(a => {
        return a.getIn(['role', 'isAgent'])
      })
      .map(a => {
        return { text: a.get('fullname'), value: a.get('_id') }
      })
      .toArray()

    const mappedGroups = this.props.groups
      .map(grp => {
        return { text: grp.get('name'), value: grp.get('_id') }
      })
      .toArray()

    const mappedTicketTypes = this.props.viewdata.ticketTypes.map(type => {
      return { text: type.name, value: type._id }
    })

    const mappedTicketTags = this.props.viewdata.ticketTags.map(tag => {
      return { text: tag.name, value: tag._id }
    })

    const mappedTicketStatuses = [
      { text: 'New', value: '0' },
      { text: 'Open', value: '1' },
      { text: 'Pedning', value: '2'},
      { text: 'Hold', value: '6' }
    ]

    let defaultGroupValue
    if (mappedGroups.length === 1) {
      defaultGroupValue = mappedGroups[0].value
    } else if (this.filter.groups && this.filter.groups.length > 0) {
      defaultGroupValue = this.filter.groups[0]
    } /* else {
      defaultGroupValue = head(mappedGroups) ? head(mappedGroups).value : ''
    } */

    return (
      <BaseModal {...this.props} options={{ bgclose: false }}>
        <form className={'uk-form-stacked'} onSubmit={e => this.onFormSubmit(e)}>
          <div className='uk-margin-medium-bottom'>
            <label>Subject</label>
            <input
              type='text'
              name={'subject'}
              className={'md-input'}
              data-validation={viewdata.ticketSettings.minSubject > 0 ? 'length' : undefined}
              data-validation-length={viewdata.ticketSettings.minSubject > 0 ? `min${viewdata.ticketSettings.minSubject}` : undefined}
              data-validation-error-msg={viewdata.ticketSettings.minSubject > 0 ? `Please enter a valid Subject. Subject must contain at least ${
                viewdata.ticketSettings.minSubject
              } characters.` : undefined}
            />
          </div>
          <div className='uk-margin-medium-bottom'>
            <Grid>
              <GridItem width={'1-2'}>
                <label className={'uk-form-label'}>Author</label>
                <SingleSelect
                  showTextbox={true}
                  items={mappedAccounts}
                  defaultValue={[this.props.viewdata.loggedInAccount._id]}
                  width={'100%'}
                  disabled={!allowAgentUserTickets}
                  ref={i => (this.ownerSelect = i)}
                />
              </GridItem>
              <GridItem width={'1-2'}>
                <label className={'uk-form-label'}>Project</label>
                <SingleSelect
                  showTextbox={false}
                  items={mappedGroups}
                  defaultValue={defaultGroupValue}
                  onSelectChange={e => this.onGroupSelectChange(e)}
                  width={'100%'}
                  disabled={mappedGroups.length === 1}
                  ref={i => (this.groupSelect = i)}
                />
              </GridItem>
            </Grid>
          </div>
          {allowAgentUserTickets && (
            <div className='uk-margin-medium-bottom'>
              <Grid>
                <GridItem width={'1-3'}>
                  <label className={'uk-form-label'}>Type</label>
                  <SingleSelect
                    showTextbox={false}
                    items={mappedTicketTypes}
                    width={'100%'}
                    defaultValue={this.props.viewdata.defaultTicketType._id}
                    onSelectChange={e => {
                      this.onTicketTypeSelectChange(e)
                    }}
                    ref={i => (this.typeSelect = i)}
                  />
                </GridItem>
                <GridItem width={'2-3'}>
                  <label className={'uk-form-label'}>Tags</label>
                  <SingleSelect
                    showTextbox={false}
                    items={mappedTicketTags}
                    width={'100%'}
                    multiple={true}
                    ref={i => (this.tagSelect = i)}
                  />
                </GridItem>
              </Grid>
            </div>
          )}
          {allowAgentUserTickets && (
            <div className='uk-margin-medium-bottom'>
              <Grid>
                <GridItem width={'2-3'}>
                  <label className={'uk-form-label'}>
                    Assignee
                    <a
                      href={() => false}
                      style={{ marginLeft: 10, opacity: 0.7 }}
                      onClick={() => {
                        this.assigneeSelect.setValue(this.props.viewdata.loggedInAccount._id)
                        this.statusSelect.setValue(1)
                        this.forceUpdate()
                      }}
                    >
                      Grab the ticket
                    </a>
                  </label>
                  <SingleSelect
                    showTextbox={false}
                    items={mappedAgentAccounts}
                    width={'100%'}
                    onSelectChange={(e) => {
                      if (e.target.value) {
                        this.statusSelect.setValue(1)
                      }

                      this.forceUpdate()
                    }}
                    ref={i => (this.assigneeSelect = i)}
                  />
                  <span style={{ marginTop: '10px', display: 'inline-block', fontSize: '11px' }} className={'uk-text-muted'}>
                    Please use the backspace key to clear the value
                  </span>
                </GridItem>
                <GridItem width={'1-3'}>
                  <label className={'uk-form-label'}>Status</label>
                  <SingleSelect
                    showTextbox={false}
                    items={mappedTicketStatuses}
                    width={'100%'}
                    defaultValue={head(mappedTicketStatuses).value}
                    onSelectChange={(e) => {
                      if (e.target.value === '0') {
                        this.assigneeSelect.setValue()
                      }

                      this.forceUpdate()
                    }}
                    ref={i => (this.statusSelect = i)}
                  />
                </GridItem>
              </Grid>
            </div>
          )}
          {helpers.canUser('tickets:priority', true) && (
            <div className='uk-margin-medium-bottom'>
              <label className={'uk-form-label'}>Priority</label>
              <div
                ref={i => (this.priorityLoader = i)}
                style={{ height: '32px', width: '32px', position: 'relative' }}
                className={'hide'}
              >
                <SpinLoader
                  style={{ background: 'transparent' }}
                  spinnerStyle={{ width: '24px', height: '24px' }}
                  active={true}
                />
              </div>
              <div ref={i => (this.priorityWrapper = i)} className={'uk-clearfix'}>
                {this.priorities.map(priority => {
                  return (
                    <div key={priority._id} className={'uk-float-left'}>
                      <span className={'icheck-inline'}>
                        <input
                          id={'p___' + priority._id}
                          name={'priority'}
                          type='radio'
                          className={'with-gap'}
                          value={priority._id}
                          onChange={e => {
                            this.onPriorityRadioChange(e)
                          }}
                          checked={this.selectedPriority === priority._id}
                          data-md-icheck
                        />
                        <label htmlFor={'p___' + priority._id} className={'mb-10 inline-label'}>
                          <span className='uk-badge' style={{ backgroundColor: priority.htmlColor }}>
                            {priority.name}
                          </span>
                        </label>
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          <div className='uk-margin-medium-bottom'>
            <span>Description</span>
            <div className='error-border-wrap uk-clearfix'>
              <EasyMDE
                ref={i => (this.issueMde = i)}
                onChange={val => (this.issueText = val)}
                allowImageUpload={true}
                inlineImageUploadUrl={'/tickets/uploadmdeimage'}
                inlineImageUploadHeaders={{ ticketid: 'uploads' }}
              />
            </div>
            <span style={{ marginTop: '6px', display: 'inline-block', fontSize: '11px' }} className={'uk-text-muted'}>
              Please try to be as specific as possible. Please include any details you think may be relevant, such as
              {/* eslint-disable-next-line react/no-unescaped-entities */}
              troubleshooting steps you've taken.
            </span>
          </div>
          <div className='uk-modal-footer uk-text-right'>
            {allowAgentUserTickets && (
              <div
                className='onoffswitch subscribeSwitch'
                style={{ display: 'inline-block', float: 'left' }}
              >
                <input
                  id={'publicSwitch'}
                  type='checkbox'
                  name='publicSwitch'
                  className='onoffswitch-checkbox'
                  ref={i => (this.publicSwitch = i)}
                />
                <label className='onoffswitch-label' htmlFor='publicSwitch'>
                  <span className='onoffswitch-inner publicSwitch-inner' />
                  <span className='onoffswitch-switch subscribeSwitch-switch' />
                </label>
              </div>
            )}
            <Button text={'Cancel'} flat={true} waves={true} extraClass={'uk-modal-close'} />
            <Button text={'Create'} style={'primary'} flat={true} type={'submit'} />
          </div>
        </form>
      </BaseModal>
    )
  }
}

CreateTicketModal.propTypes = {
  shared: PropTypes.object.isRequired,
  viewdata: PropTypes.object.isRequired,
  accounts: PropTypes.object.isRequired,
  groups: PropTypes.object.isRequired,
  createTicket: PropTypes.func.isRequired,
  fetchAccounts: PropTypes.func.isRequired,
  fetchGroups: PropTypes.func.isRequired
}

const mapStateToProps = state => ({
  shared: state.shared,
  viewdata: state.common,
  accounts: state.accountsState.accountsCreateTicket,
  groups: state.groupsState.groups
})

export default connect(
  mapStateToProps,
  { createTicket, fetchAccounts: fetchAccountsCreateTicket, fetchGroups }
)(CreateTicketModal)

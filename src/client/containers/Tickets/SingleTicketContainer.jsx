/*
 *       .                             .o8                     oooo
 *    .o8                             "888                     `888
 *  .o888oo oooo d8b oooo  oooo   .oooo888   .ooooo.   .oooo.o  888  oooo
 *    888   `888""8P `888  `888  d88' `888  d88' `88b d88(  "8  888 .8P'
 *    888    888      888   888  888   888  888ooo888 `"Y88b.   888888.
 *    888 .  888      888   888  888   888  888    .o o.  )88b  888 `88b.
 *    "888" d888b     `V88V"V8P' `Y8bod88P" `Y8bod8P' 8""888P' o888o o888o
 *  ========================================================================
 *  Updated:    6/21/19 9:32 AM
 *  Copyright (c) 2014-2019 Trudesk, Inc. All rights reserved.
 */

import React, { Fragment } from 'react'
import PropTypes from 'prop-types'
import { connect } from 'react-redux'
import { observable, computed } from 'mobx'
import { observer } from 'mobx-react'
import sortBy from 'lodash/sortBy'
import union from 'lodash/union'
import uniqBy from 'lodash/uniqBy'

import { fetchAccounts, unloadAccounts } from 'actions/accounts'
import { transferToThirdParty } from 'actions/tickets'
import { fetchGroups, unloadGroups } from 'actions/groups'
import { showModal } from 'actions/common'

import AssigneeDropdownPartial from 'containers/Tickets/AssigneeDropdownPartial'
import Avatar from 'components/Avatar/Avatar'
import CommentNotePartial from 'containers/Tickets/CommentNotePartial'
import DatePicker from 'components/DatePicker'
import EasyMDE from 'components/EasyMDE'
import IssuePartial from 'containers/Tickets/IssuePartial'
import OffCanvasEditor from 'components/OffCanvasEditor'
import PDropdownTrigger from 'components/PDropdown/PDropdownTrigger'
import StatusSelector from 'containers/Tickets/StatusSelector'
import TruTabSection from 'components/TruTabs/TruTabSection'
import TruTabSelector from 'components/TruTabs/TruTabSelector'
import TruTabSelectors from 'components/TruTabs/TruTabSelectors'
import TruTabWrapper from 'components/TruTabs/TruTabWrapper'

import axios from 'axios'
import helpers from 'lib/helpers'
import Log from '../../logger'
import socket from 'lib/socket'
import UIkit from 'uikit'
import moment from 'moment'
import SpinLoader from 'components/SpinLoader'

const fetchTicket = parent => {
  axios
    .get(`/api/v2/tickets/${parent.props.ticketUid}`)
    .then(res => {
      // setTimeout(() => {
      parent.ticket = res.data.ticket
      parent.isSubscribed =
        parent.ticket && parent.ticket.subscribers.findIndex(i => i._id === parent.props.shared.sessionUser._id) !== -1
      // }, 3000)
    })
    .catch(error => {
      Log.error(error)
    })
}

const showPriorityConfirm = () => {
  UIkit.modal.confirm(
    'Selected Priority does not exist for this ticket type.<br><br><strong>Please select a new priority</strong>',
    () => { },
    { cancelButtonClass: 'uk-hidden' }
  )
}

@observer
class SingleTicketContainer extends React.Component {
  @observable ticket = null
  @observable isSubscribed = false
  @observable isHistoryOpened = false

  constructor (props) {
    super(props)

    this.onSocketUpdateComments = this.onSocketUpdateComments.bind(this)
    this.onUpdateTicketNotes = this.onUpdateTicketNotes.bind(this)
    this.onUpdateAssignee = this.onUpdateAssignee.bind(this)
    this.onUpdateTicketOwner = this.onUpdateTicketOwner.bind(this)
    this.onUpdateTicketType = this.onUpdateTicketType.bind(this)
    this.onUpdateTicketPriority = this.onUpdateTicketPriority.bind(this)
    this.onUpdateTicketGroup = this.onUpdateTicketGroup.bind(this)
    this.onUpdateTicketDueDate = this.onUpdateTicketDueDate.bind(this)
    this.onUpdateTicketTags = this.onUpdateTicketTags.bind(this)
    this.onUpdateTicketPublic = this.onUpdateTicketPublic.bind(this)
  }

  componentDidMount () {
    socket.socket.on('updateComments', this.onSocketUpdateComments)
    socket.socket.on('updateNotes', this.onUpdateTicketNotes)
    socket.socket.on('updateAssignee', this.onUpdateAssignee)
    socket.socket.on('updateTicketOwner', this.onUpdateTicketOwner)
    socket.socket.on('updateTicketType', this.onUpdateTicketType)
    socket.socket.on('updateTicketPriority', this.onUpdateTicketPriority)
    socket.socket.on('updateTicketGroup', this.onUpdateTicketGroup)
    socket.socket.on('updateTicketDueDate', this.onUpdateTicketDueDate)
    socket.socket.on('updateTicketTags', this.onUpdateTicketTags)
    socket.socket.on('updateTicketPublic', this.onUpdateTicketPublic)

    fetchTicket(this)
    this.props.fetchAccounts({ type: 'all:available', limit: -1 })
    this.props.fetchGroups()
  }

  componentDidUpdate () {
    helpers.resizeFullHeight()
    helpers.setupScrollers()
  }

  componentWillUnmount () {
    socket.socket.off('updateComments', this.onSocketUpdateComments)
    socket.socket.off('updateNotes', this.onUpdateTicketNotes)
    socket.socket.off('updateAssignee', this.onUpdateAssignee)
    socket.socket.off('updateTicketOwner', this.onUpdateTicketOwner)
    socket.socket.off('updateTicketType', this.onUpdateTicketType)
    socket.socket.off('updateTicketPriority', this.onUpdateTicketPriority)
    socket.socket.off('updateTicketGroup', this.onUpdateTicketGroup)
    socket.socket.off('updateTicketDueDate', this.onUpdateTicketDueDate)
    socket.socket.off('updateTicketTags', this.onUpdateTicketTags)
    socket.socket.off('updateTicketPublic', this.onUpdateTicketPublic)

    this.props.unloadAccounts()
    this.props.unloadGroups()
  }

  onSocketUpdateComments (data) {
    if (this.ticket._id === data._id) this.ticket.comments = data.comments
  }

  onUpdateTicketNotes (data) {
    if (this.ticket._id === data._id) this.ticket.notes = data.notes
  }

  onUpdateAssignee (data) {
    if (this.ticket._id === data._id) {
      this.ticket.assignee = data.assignee
      if (this.ticket.assignee && this.ticket.assignee._id === this.props.shared.sessionUser._id)
        this.isSubscribed = true
      this.ticket.status = data.status
    }
  }

  onUpdateTicketOwner (data) {
    if (this.ticket._id === data._id) this.ticket.owner = data.owner
  }

  onUpdateTicketType (data) {
    if (this.ticket._id === data._id) this.ticket.type = data.type
  }

  onUpdateTicketPriority (data) {
    if (this.ticket._id === data._id) this.ticket.priority = data.priority
  }

  onUpdateTicketGroup (data) {
    if (this.ticket._id === data._id) {
      this.ticket.group = data.group
      this.ticket.status = data.status
    }
  }

  onUpdateTicketDueDate (data) {
    if (this.ticket._id === data._id) {
      this.ticket.dueDate = data.dueDate
      this.ticket.status = data.status
    }
  }

  onUpdateTicketTags (data) {
    if (this.ticket._id === data._id) this.ticket.tags = data.tags
  }

  onUpdateTicketPublic (data) {
    if (this.ticket._id === data._id) this.ticket.public = data.public
  }

  onCommentNoteSubmit (e, type) {
    e.preventDefault()
    const isNote = type === 'note'
    axios
      .post(`/api/v1/tickets/add${isNote ? 'note' : 'comment'}`, {
        _id: !isNote && this.ticket._id,
        comment: !isNote && this.commentMDE.getEditorText(),

        ticketid: isNote && this.ticket._id,
        note: isNote && this.noteMDE.getEditorText()
      })
      .then(res => {
        if (res && res.data && res.data.success) {
          if (isNote) {
            this.ticket.notes = res.data.ticket.notes
            this.noteMDE.setEditorText('')
          } else {
            this.ticket.comments = res.data.ticket.comments
            this.commentMDE.setEditorText('')
          }

          helpers.scrollToBottom('.page-content-right', true)
          this.ticket.history = res.data.ticket.history
        }
      })
      .catch(error => {
        Log.error(error)
        if (error.response) Log.error(error.response)
        helpers.UI.showSnackbar(error, true)
      })
  }

  onSubscriberChanged (e) {
    axios
      .put(`/api/v1/tickets/${this.ticket._id}/subscribe`, {
        user: this.props.shared.sessionUser._id,
        subscribe: e.target.checked
      })
      .then(res => {
        if (res.data.success && res.data.ticket) {
          this.ticket.subscribers = res.data.ticket.subscribers
          this.isSubscribed = this.ticket.subscribers.findIndex(i => i._id === this.props.shared.sessionUser._id) !== -1
        }
      })
      .catch(error => {
        Log.error(error.response || error)
      })
  }

  transferToThirdParty (e) {
    socket.ui.sendUpdateTicketStatus(this.ticket._id, 3)
    this.props.transferToThirdParty({ uid: this.ticket.uid })
  }

  @computed
  get notesTagged () {
    this.ticket.notes.forEach(i => (i.isNote = true))

    return this.ticket.notes
  }

  @computed get commentsAndNotes () {
    if (!this.ticket) return []
    if (!helpers.canUser('tickets:notes', true)) {
      return sortBy(this.ticket.comments, 'date')
    }

    let commentsAndNotes = union(this.ticket.comments, this.notesTagged)
    commentsAndNotes = sortBy(commentsAndNotes, 'date')

    return commentsAndNotes
  }

  @computed get hasCommentsOrNotes () {
    if (!this.ticket) return false
    return this.ticket.comments.length > 0 || this.ticket.notes.length > 0
  }

  render () {
    const selectedGroup = this.ticket
      && this.props.groupsState
      && (this.props.groupsState.groups.find((group) => group.get('_id') === this.ticket.group._id) || null)

    let availableAccounts
    if (selectedGroup) {
      availableAccounts = this.props.accountsState
        ? this.props.accountsState.accounts
          .filter((account) => selectedGroup.get('availableAccountIds').includes(account.get('_id')))
          .toArray()
        : []
    } else {
      availableAccounts = []
    }

    const availableAssigneeAccounts = availableAccounts = availableAccounts.filter((account) => {
      return !account.getIn(['role', 'isAdmin']) || account.getIn(['role', 'isAgent'])
    })

    const mappedOwnerAccounts = availableAccounts.map(a => {
      return { text: a.get('fullname'), value: a.get('_id') }
    })

    const mappedGroups = this.props.groupsState
      ? uniqBy(
        this.props.groupsState.groups
          .map((group) => {
            return { text: group.get('name'), value: group.get('_id') };
          })
          .toArray(),
        'value',
      )
      : []

    const mappedTypes = this.props.common.ticketTypes
      ? this.props.common.ticketTypes.map(type => {
        return { text: type.name, value: type._id, raw: type }
      })
      : []

    const isAdminOrAgent = this.props.shared.sessionUser && (this.props.shared.sessionUser.role.isAdmin || this.props.shared.sessionUser.role.isAgent)

    // Perms
    const hasTicketUpdate =
      this.ticket &&
      (
        (this.ticket.status !== 3 && helpers.hasPermOverRole(this.ticket.owner.role, null, 'tickets:update', true)) ||
        (this.ticket.owner._id === this.props.shared.sessionUser._id && !isAdminOrAgent)
      )

    return (
      <div className={'uk-clearfix uk-position-relative'} style={{ width: '100%', height: '100vh' }}>
        {!this.ticket && <SpinLoader active={true} />}
        {this.ticket && (
          <Fragment>
            <div className={'page-content'}>
              <div
                className='uk-float-left page-title page-title-small noshadow nopadding relative'
                style={{ width: 360, maxWidth: 360, minWidth: 360 }}
              >
                <div className='page-title-border-right relative' style={{ padding: '0 30px' }}>
                  {/* <span className="tag-list" style={{ display: 'inline-block' }}>
                    <span className="title-tag" style={{ background: this.ticket.priority.htmlColor }}>Ticket</span>
                  </span> */}
                  <p>Ticket #{this.ticket.uid}</p>
                  <StatusSelector
                    ticketId={this.ticket._id}
                    status={this.ticket.status}
                    onStatusChange={(status, assignee) => {
                      this.ticket.status = status
                      this.ticket.assignee = assignee
                    }}
                    hasPerm={helpers.hasPermOverRole(this.ticket.owner.role, null, 'tickets:update', true) && isAdminOrAgent}
                    canSetLiveOrPending={!this.ticket.assignee || (this.props.shared.sessionUser && (this.props.shared.sessionUser.role.isAdmin || this.ticket.assignee._id === this.props.shared.sessionUser._id))}
                  />
                </div>
                {/*  Left Side */}
                <div className='page-content-left full-height scrollable'>
                  <div className='ticket-details-wrap uk-position-relative uk-clearfix'>
                    {isAdminOrAgent ? (
                      <>
                        <div
                          className='onoffswitch subscribeSwitch uk-float-left'
                          style={{ top: 14, left: 240 }}
                        >
                          <input
                            id={'publicSwitch_'}
                            type='checkbox'
                            name='publicSwitch'
                            className='onoffswitch-checkbox'
                            checked={this.ticket.public}
                            disabled={!helpers.canUser('tickets:update', true)}
                            onChange={e => {
                              e.preventDefault()
                              socket.ui.setTicketPublic(this.ticket._id, e.target.checked)
                            }}
                          />
                          <label className='onoffswitch-label' htmlFor='publicSwitch_'>
                            <span className='onoffswitch-inner publicSwitch-inner' />
                            <span className='onoffswitch-switch subscribeSwitch-switch' />
                          </label>
                        </div>
                        <div className='ticket-assignee-wrap uk-clearfix' style={{ paddingRight: 30 }}>
                          <h4>Assignee</h4>
                          <div className='ticket-assignee uk-clearfix'>
                            {hasTicketUpdate && (
                              <a
                                role='button'
                                title='Set Assignee'
                                style={{ float: 'left' }}
                                className='relative no-ajaxy'
                                onClick={() => socket.socket.emit('updateAssigneeList')}
                              >
                                <PDropdownTrigger target={'assigneeDropdown'}>
                                  <Avatar
                                    image={this.ticket.assignee && this.ticket.assignee.image}
                                    showOnlineBubble={this.ticket.assignee !== undefined}
                                    userId={this.ticket.assignee && this.ticket.assignee._id}
                                  />
                                  <span className='drop-icon material-icons'>keyboard_arrow_down</span>
                                </PDropdownTrigger>
                              </a>
                            )}
                            {!hasTicketUpdate && (
                              <Avatar
                                image={this.ticket.assignee && this.ticket.assignee.image}
                                showOnlineBubble={this.ticket.assignee !== undefined}
                                userId={this.ticket.assignee && this.ticket.assignee._id}
                              />
                            )}
                            <div className='ticket-assignee-details'>
                              {!this.ticket.assignee && (
                                <>
                                  <h3>No User Assigned</h3>
                                  {isAdminOrAgent && (
                                    <a
                                      role='button'
                                      className='btn no-ajaxy grab-ticket'
                                      onClick={e => {
                                        e.preventDefault()
                                        socket.socket.emit('setAssignee', { _id: this.props.shared.sessionUser._id, ticketId: this.ticket._id })
                                        this.ticket.assignee = this.props.shared.sessionUser
                                      }}
                                    >
                                      Grab The Ticket
                                    </a>
                                  )}
                                </>
                              )}
                              {this.ticket.assignee && (
                                <Fragment>
                                  <h3>{this.ticket.assignee.fullname}</h3>
                                  <span className={'uk-display-block'}>{this.ticket.assignee.title}</span>
                                </Fragment>
                              )}
                            </div>
                          </div>

                          {hasTicketUpdate && (
                            <AssigneeDropdownPartial
                              ticketId={this.ticket._id}
                              availableAccountIds={availableAssigneeAccounts.map((account) => account.get('_id'))}
                              onClearClick={() => (this.ticket.assignee = undefined)}
                              onAssigneeClick={({ agent }) => (this.ticket.assignee = agent)}
                            />
                          )}
                        </div>
                      </>
                    ) : <div style={{ marginBottom: 30, paddingRight: 30 }} />}

                    <div className='uk-width-1-1 padding-left-right-15'>
                      <div className='tru-card ticket-details uk-clearfix'>
                        {/*  Owner */}
                        {helpers.canUser('tickets:createForOthers', true) && (
                          <div className='uk-width-1-1 nopadding uk-clearfix'>
                            <span>Author</span>
                            {hasTicketUpdate && (
                              <select
                                value={this.ticket.owner._id}
                                className='bold-value'
                                onChange={e => {
                                  socket.ui.setTicketOwner(this.ticket._id, e.target.value)
                                }}
                              >
                                {mappedOwnerAccounts &&
                                  mappedOwnerAccounts.map(account => (
                                    <option key={account.value} value={account.value}>
                                      {account.text}
                                    </option>
                                  ))}
                              </select>
                            )}
                          </div>
                        )}
                        {/* Type */}
                        <div className='uk-width-1-2 uk-float-left nopadding'>
                          <div className='marginright5'>
                            <span>Type</span>
                            {hasTicketUpdate && (
                              <select
                                value={this.ticket.type._id}
                                className='bold-value'
                                onChange={e => {
                                  const type = this.props.common.ticketTypes.find(t => t._id === e.target.value)
                                  const hasPriority =
                                    type.priorities.findIndex(p => p._id === this.ticket.priority._id) !== -1

                                  if (!hasPriority) {
                                    socket.ui.setTicketPriority(
                                      this.ticket._id,
                                      type.priorities.find(() => true)
                                    )
                                    showPriorityConfirm()
                                  }

                                  socket.ui.setTicketType(this.ticket._id, e.target.value)
                                }}
                              >
                                {mappedTypes &&
                                  mappedTypes.map(type => (
                                    <option key={type.value} value={type.value}>
                                      {type.text}
                                    </option>
                                  ))}
                              </select>
                            )}
                            {!hasTicketUpdate && <div className='input-box bold-value'>{this.ticket.type.name}</div>}
                          </div>
                        </div>
                        {/* Priority */}
                        <div className='uk-width-1-2 uk-float-left nopadding'>
                          <div className='marginleft5'>
                            <span>Priority</span>
                            {hasTicketUpdate && (isAdminOrAgent || helpers.canUser('tickets:priority', true)) ? (
                              <select
                                name='tPriority'
                                id='tPriority'
                                value={this.ticket.priority._id}
                                className='bold-value'
                                onChange={e => socket.ui.setTicketPriority(this.ticket._id, e.target.value)}
                              >
                                {this.ticket.type &&
                                  this.ticket.type.priorities &&
                                  this.ticket.type.priorities.map(priority => (
                                    <option key={priority._id} value={priority._id}>
                                      {priority.name}
                                    </option>
                                  ))}
                              </select>
                            ) : (
                              <div className={'input-box bold-value'}>{this.ticket.priority.name}</div>
                            )}
                          </div>
                        </div>
                        {/*  Group */}
                        <div className='uk-width-1-1 nopadding uk-clearfix'>
                          <span>Project</span>
                          {hasTicketUpdate && (
                            <select
                              value={this.ticket.group._id}
                              className='bold-value'
                              onChange={e => {
                                const selectedGroup = this.props.groupsState && (this.props.groupsState.groups.find((group) => group.get('_id') === e.target.value) || null)
                                if (!selectedGroup) {
                                  return
                                }

                                if (!selectedGroup.get('availableAccountIds').includes(this.ticket.owner._id)) {
                                  this.ticket.owner = this.props.shared.sessionUser
                                  socket.ui.setTicketOwner(this.ticket._id, this.props.shared.sessionUser._id)
                                }

                                if (this.ticket.assignee && !selectedGroup.get('availableAccountIds').includes(this.ticket.assignee._id)) {
                                  this.ticket.assignee = undefined
                                  socket.socket.emit('clearAssignee', this.props.ticketId)
                                }

                                socket.ui.setTicketGroup(this.ticket._id, e.target.value)
                              }}
                            >
                              {mappedGroups &&
                                mappedGroups.map(group => (
                                  <option key={group.value} value={group.value}>
                                    {group.text}
                                  </option>
                                ))}
                            </select>
                          )}
                          {!hasTicketUpdate && <div className={'input-box bold-value'}>{this.ticket.group.name}</div>}
                        </div>
                        {/*  Due Date */}
                        {(this.ticket.dueDate || hasTicketUpdate) && (
                          <div className='uk-width-1-1 p-0'>
                            <span>Due Date</span> {hasTicketUpdate && <span>-&nbsp;</span>}
                            {hasTicketUpdate && (
                              <div className={'uk-display-inline'}>
                                <a
                                  role={'button'}
                                  onClick={e => {
                                    e.preventDefault()
                                    socket.ui.setTicketDueDate(this.ticket._id, undefined)
                                  }}
                                >
                                  Clear
                                </a>
                                <DatePicker
                                  format={helpers.getShortDateFormat()}
                                  value={this.ticket.dueDate}
                                  className='bold-value'
                                  onChange={e => {
                                    const dueDate = moment(e.target.value, helpers.getShortDateFormat())
                                      .utc()
                                      .toISOString()
                                    socket.ui.setTicketDueDate(this.ticket._id, dueDate)
                                  }}
                                />
                              </div>
                            )}
                            {!hasTicketUpdate && (
                              <div className='input-box bold-value'>
                                {helpers.formatDate(this.ticket.dueDate, this.props.common.shortDateFormat)}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Tags */}
                        <div className='uk-width-1-1 nopadding'>
                          <span>
                            Tags
                            {hasTicketUpdate && isAdminOrAgent && (
                              <Fragment>
                                <span> - </span>
                                <div id='editTags' className={'uk-display-inline'}>
                                  <a
                                    role={'button'}
                                    style={{ fontSize: 11 }}
                                    className='no-ajaxy'
                                    onClick={() => {
                                      this.props.showModal('ADD_TAGS_MODAL', {
                                        ticketId: this.ticket._id,
                                        currentTags: this.ticket.tags.map(tag => tag._id)
                                      })
                                    }}
                                  >
                                    Edit Tags
                                  </a>
                                </div>
                              </Fragment>
                            )}
                          </span>
                          <div className='tag-list uk-clearfix'>
                            {this.ticket.tags &&
                              this.ticket.tags.map(tag => (
                                <div key={tag._id} className='item'>
                                  {tag.name}
                                </div>
                              ))}
                          </div>
                        </div>

                        {helpers.canUser('agent:*', true) && (
                          <div style={{ textAlign: 'center' }}>
                            <a
                              role={'button'}
                              onClick={() => {
                                this.isHistoryOpened = !this.isHistoryOpened
                              }}
                            >
                              {this.isHistoryOpened ? 'Hide History' : 'Show History'}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    {this.isHistoryOpened && helpers.canUser('agent:*', true) && (
                      <div className='uk-width-1-1 padding-left-right-15'>
                        <div className='tru-card ticket-details pr-0 pb-0' style={{ height: 250 }}>
                          Ticket History
                          <hr style={{ padding: 0, margin: 0 }} />
                          <div className='history-items scrollable' style={{ paddingTop: 12 }}>
                            {this.ticket.history &&
                              this.ticket.history.map(item => (
                                <div key={item._id} className='history-item'>
                                  <time dateTime={helpers.formatDate(item.date, this.props.common.longDateFormat)} />
                                  <em>
                                    Action by: <span>{item.owner.fullname}</span>
                                  </em>
                                  <p>{item.description}</p>
                                </div>
                              ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {/* Right Side */}
              <div className='page-message nopadding' style={{ marginLeft: 360 }}>
                <div className='page-title-right noshadow'>
                  {isAdminOrAgent && (
                    <>
                      {this.ticket.status !== 4 && (
                        <div className='page-top-comments uk-float-left'>
                          <a
                            role='button'
                            className='btn no-ajaxy ticket-status-live'
                            onClick={e => {
                              e.preventDefault()
                              socket.ui.sendUpdateTicketStatus(this.ticket._id, 4)
                              this.ticket.status = 4
                            }}
                          >
                            Start Ticket
                          </a>
                        </div>
                      )}
                      {this.ticket.status !== 6 && helpers.canUser('tickets:closing', true) && (
                        <div className='page-top-comments uk-float-left'>
                          <a
                            role='button'
                            className='btn no-ajaxy ticket-status-hold'
                            onClick={e => {
                              e.preventDefault()
                              socket.ui.sendUpdateTicketStatus(this.ticket._id, 6)
                              this.ticket.status = 6
                            }}
                          >
                            Put On Hold
                          </a>
                        </div>
                      )}
                      {this.ticket.status === 4 && (
                        <div className='page-top-comments uk-float-left'>
                          <a
                            role='button'
                            className='btn no-ajaxy ticket-status-pending'
                            onClick={e => {
                              e.preventDefault()
                              socket.ui.sendUpdateTicketStatus(this.ticket._id, 2)
                              this.ticket.status = 2
                            }}
                          >
                            Pause
                          </a>
                        </div>
                      )}
                      {[1, 2, 4].includes(this.ticket.status) && (
                        <div className='page-top-comments uk-float-left'>
                          <a
                            role='button'
                            className='btn no-ajaxy ticket-status-done'
                            onClick={e => {
                              e.preventDefault()
                              socket.ui.sendUpdateTicketStatus(this.ticket._id, 5)
                              this.ticket.status = 5
                            }}
                          >
                            Done
                          </a>
                        </div>
                      )}
                    </>
                  )}
                  {this.props.common.hasThirdParty && (
                    <div className='page-top-comments uk-float-right'>
                      <a
                        role='button'
                        className='btn md-btn-primary no-ajaxy'
                        onClick={e => {
                          e.preventDefault()
                          this.transferToThirdParty(e)
                        }}
                      >
                        Transfer to ThirdParty
                      </a>
                    </div>
                  )}
                  {helpers.canUser('comments:create', true) && (
                    <div className='page-top-comments uk-float-right'>
                      <a
                        role='button'
                        className='btn no-ajaxy'
                        onClick={e => {
                          e.preventDefault()
                          helpers.scrollToBottom('.page-content-right', true)
                        }}
                      >
                        Add Comment
                      </a>
                    </div>
                  )}
                  <div
                    className='onoffswitch subscribeSwitch uk-float-right'
                    style={{ marginRight: 10, position: 'relative', top: 18 }}
                  >
                    <input
                      id={'subscribeSwitch'}
                      type='checkbox'
                      name='subscribeSwitch'
                      className='onoffswitch-checkbox'
                      checked={this.isSubscribed}
                      disabled={this.isSubscribed && this.ticket.assignee && this.ticket.assignee._id === this.props.shared.sessionUser._id}
                      onChange={e => this.onSubscriberChanged(e)}
                    />
                    <label className='onoffswitch-label' htmlFor='subscribeSwitch'>
                      <span className='onoffswitch-inner subscribeSwitch-inner' />
                      <span className='onoffswitch-switch subscribeSwitch-switch' />
                    </label>
                  </div>
                  <div className='pagination uk-float-right' style={{ marginRight: 5 }}>
                    <ul className='button-group'>
                      <li className='pagination'>
                        <a
                          href={`/tickets/print/${this.ticket.uid}`}
                          className='btn no-ajaxy'
                          style={{ borderRadius: 3, marginRight: 5 }}
                          rel='noopener noreferrer'
                          target='_blank'
                        >
                          <i className='material-icons'>&#xE8AD;</i>
                        </a>
                      </li>
                    </ul>
                  </div>
                </div>
                <div className='page-content-right full-height scrollable' style={{
                  background: '#f7f8fa'
                }}>
                  <div className='comments-wrapper'>
                    <IssuePartial
                      ticketId={this.ticket._id}
                      status={this.ticket.status}
                      owner={this.ticket.owner}
                      subject={this.ticket.subject}
                      issue={this.ticket.issue}
                      date={this.ticket.date}
                      dateFormat={`${this.props.common.longDateFormat}, ${this.props.common.timeFormat}`}
                      attachments={this.ticket.attachments}
                      editorWindow={this.editorWindow}
                    />

                    {(this.hasCommentsOrNotes || this.ticket.status !== 3) && (
                      <div style={{
                        background: '#fff',
                        boxShadow: '0 1px 3px rgb(0 0 0 / 12%), 0 1px 2px rgb(0 0 0 / 24%)',
                        margin: '30px'
                      }}>
                        {/* Tabs */}
                        {this.hasCommentsOrNotes && (
                          <TruTabWrapper>
                            <TruTabSelectors style={{ marginLeft: 110, width: 'calc(100% - 110px)' }}>
                              {helpers.canUser('tickets:notes', true) && (
                                <TruTabSelector
                                  selectorId={0}
                                  label='All'
                                  active={true}
                                  showBadge={true}
                                  badgeText={this.commentsAndNotes.length}
                                />
                              )}
                              <TruTabSelector
                                selectorId={1}
                                label='Comments'
                                active={!helpers.canUser('tickets:notes', true)}
                                showBadge={true}
                                badgeText={this.ticket ? this.ticket.comments && this.ticket.comments.length : 0}
                              />
                              {helpers.canUser('tickets:notes', true) && (
                                <TruTabSelector
                                  selectorId={2}
                                  label='Notes'
                                  showBadge={true}
                                  badgeText={this.ticket ? this.ticket.notes && this.ticket.notes.length : 0}
                                />
                              )}
                            </TruTabSelectors>

                            {/* Tab Sections */}
                            <TruTabSection sectionId={0} active={helpers.canUser('tickets:notes', true)}>
                              <div className='all-comments'>
                                {this.commentsAndNotes.map(item => (
                                  <CommentNotePartial
                                    key={item._id}
                                    ticketStatus={this.ticket.status}
                                    ticketSubject={this.ticket.subject}
                                    comment={item}
                                    isNote={item.isNote}
                                    dateFormat={`${this.props.common.longDateFormat}, ${this.props.common.timeFormat}`}
                                    onEditClick={() => {
                                      this.editorWindow.openEditorWindow({
                                        showSubject: false,
                                        text: !item.isNote ? item.comment : item.note,
                                        onPrimaryClick: data => {
                                          if (item.isNote) socket.ui.setNoteText(this.ticket._id, item._id, data.text)
                                          else socket.ui.setCommentText(this.ticket._id, item._id, data.text)
                                        }
                                      })
                                    }}
                                    onRemoveClick={() => {
                                      if (!item.isNote) socket.ui.removeComment(this.ticket._id, item._id)
                                      else socket.ui.removeNote(this.ticket._id, item._id)
                                    }}
                                  />
                                ))}
                              </div>
                            </TruTabSection>
                            <TruTabSection sectionId={1} active={!helpers.canUser('tickets:notes', true)}>
                              <div className='comments'>
                                {this.ticket &&
                                  this.ticket.comments.map(comment => (
                                    <CommentNotePartial
                                      key={comment._id}
                                      ticketStatus={this.ticket.status}
                                      ticketSubject={this.ticket.subject}
                                      comment={comment}
                                      dateFormat={`${this.props.common.longDateFormat}, ${this.props.common.timeFormat}`}
                                      onEditClick={() => {
                                        this.editorWindow.openEditorWindow({
                                          showSubject: false,
                                          text: comment.comment,
                                          onPrimaryClick: data => {
                                            socket.ui.setCommentText(this.ticket._id, comment._id, data.text)
                                          }
                                        })
                                      }}
                                      onRemoveClick={() => {
                                        socket.ui.removeComment(this.ticket._id, comment._id)
                                      }}
                                    />
                                  ))}
                              </div>
                            </TruTabSection>
                            <TruTabSection sectionId={2}>
                              <div className='notes'>
                                {this.ticket &&
                                  this.ticket.notes.map(note => (
                                    <CommentNotePartial
                                      key={note._id}
                                      ticketStatus={this.ticket.status}
                                      ticketSubject={this.ticket.subject}
                                      comment={note}
                                      isNote={true}
                                      dateFormat={`${this.props.common.longDateFormat}, ${this.props.common.timeFormat}`}
                                      onEditClick={() => {
                                        this.editorWindow.openEditorWindow({
                                          showSubject: false,
                                          text: note.note,
                                          onPrimaryClick: data => {
                                            socket.ui.setNoteText(this.ticket._id, note._id, data.text)
                                          }
                                        })
                                      }}
                                      onRemoveClick={() => {
                                        socket.ui.removeNote(this.ticket._id, note._id)
                                      }}
                                    />
                                  ))}
                              </div>
                            </TruTabSection>
                          </TruTabWrapper>
                        )}

                        {/* Comment / Notes Form */}
                        {this.ticket.status !== 3 && (helpers.canUser('comments:create', true) || helpers.canUser('tickets:notes', true)) && (
                          <div className='uk-width-1-1 ticket-reply uk-clearfix'>
                            <Avatar image={this.props.shared.sessionUser.image} showOnlineBubble={false} />
                            <TruTabWrapper style={{ paddingLeft: 85 }}>
                              <TruTabSelectors showTrack={false}>
                                {helpers.canUser('comments:create', true) && (
                                  <TruTabSelector selectorId={0} label={'Comment'} active={true} />
                                )}
                                {helpers.canUser('tickets:notes', true) && (
                                  <TruTabSelector
                                    selectorId={1}
                                    label={'Internal Note'}
                                    active={!helpers.canUser('comments:create', true)}
                                  />
                                )}
                              </TruTabSelectors>
                              <TruTabSection
                                sectionId={0}
                                style={{ paddingTop: 0 }}
                                active={helpers.canUser('comments:create', true)}
                              >
                                <form onSubmit={e => this.onCommentNoteSubmit(e, 'comment')}>
                                  <EasyMDE
                                    allowImageUpload={true}
                                    inlineImageUploadUrl={'/tickets/uploadmdeimage'}
                                    inlineImageUploadHeaders={{ ticketid: this.ticket._id }}
                                    ref={r => (this.commentMDE = r)}
                                  />
                                  <div className='uk-width-1-1 uk-clearfix' style={{ marginTop: 50 }}>
                                    <div className='uk-float-right'>
                                      <button
                                        type='submit'
                                        className='uk-button uk-button-accent'
                                        style={{ padding: '10px 15px' }}
                                      >
                                        Post Comment
                                      </button>
                                    </div>
                                  </div>
                                </form>
                              </TruTabSection>
                              <TruTabSection
                                sectionId={1}
                                style={{ paddingTop: 0 }}
                                active={!helpers.canUser('comments:create') && helpers.canUser('tickets:notes', true)}
                              >
                                <form onSubmit={e => this.onCommentNoteSubmit(e, 'note')}>
                                  <EasyMDE
                                    allowImageUpload={true}
                                    inlineImageUploadUrl={'/tickets/uploadmdeimage'}
                                    inlineImageUploadHeaders={{ ticketid: this.ticket._id }}
                                    ref={r => (this.noteMDE = r)}
                                  />
                                  <div className='uk-width-1-1 uk-clearfix' style={{ marginTop: 50 }}>
                                    <div className='uk-float-right'>
                                      <button
                                        type='submit'
                                        className='uk-button uk-button-accent'
                                        style={{ padding: '10px 15px' }}
                                      >
                                        Save Note
                                      </button>
                                    </div>
                                  </div>
                                </form>
                              </TruTabSection>
                            </TruTabWrapper>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <OffCanvasEditor
              allowUploads
              primaryLabel={'Save Edit'}
              uploadURL={'/tickets/uploadmdeimage'}
              uploadHeaders={{ ticketid: this.ticket._id }}
              ref={r => (this.editorWindow = r)}
            />
          </Fragment>
        )}
      </div>
    )
  }
}

SingleTicketContainer.propTypes = {
  ticketId: PropTypes.string.isRequired,
  ticketUid: PropTypes.string.isRequired,
  shared: PropTypes.object.isRequired,
  common: PropTypes.object.isRequired,
  accountsState: PropTypes.object.isRequired,
  fetchAccounts: PropTypes.func.isRequired,
  unloadAccounts: PropTypes.func.isRequired,
  groupsState: PropTypes.object.isRequired,
  fetchGroups: PropTypes.func.isRequired,
  unloadGroups: PropTypes.func.isRequired,
  showModal: PropTypes.func.isRequired,
  transferToThirdParty: PropTypes.func
}

const mapStateToProps = state => ({
  common: state.common,
  shared: state.shared,
  accountsState: state.accountsState,
  groupsState: state.groupsState
})

export default connect(mapStateToProps, { fetchAccounts, unloadAccounts, fetchGroups, unloadGroups, showModal, transferToThirdParty })(
  SingleTicketContainer
)

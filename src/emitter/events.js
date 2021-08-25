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
 *  Updated:    1/20/19 4:43 PM
 *  Copyright (c) 2014-2019. All rights reserved.
 */

var _ = require('lodash')
var path = require('path')
var async = require('async')
var winston = require('winston')
var emitter = require('../emitter')
var util = require('../helpers/utils')
var templateSchema = require('../models/template')
var ticketSchema = require('../models/ticket')
var userSchema = require('../models/user')
var departmentSchema = require('../models/department')
var NotificationSchema = require('../models/notification')
var settingsSchema = require('../models/setting')
var Email = require('email-templates')
var templateDir = path.resolve(__dirname, '..', 'mailer', 'templates')
var permissions = require('../permissions')

var socketUtils = require('../helpers/utils')
var sharedVars = require('../socketio/index').shared

var notifications = require('../notifications') // Load Push Events

function statusToString (status) {
  var str
  switch (status) {
    case 0:
      str = 'New'
      break
    case 1:
      str = 'Open'
      break
    case 2:
      str = 'Pending'
      break
    case 3:
      str = 'Closed'
      break
    case 4:
      str = 'Live'
      break
    case 5:
      str = 'Done'
      break
    case 6:
      str = 'Hold'
      break
    default:
      str = status
      break
  }

  return str
}

;(function () {
  notifications.init(emitter)

  emitter.on('ticket:created', function (data) {
    var ticketObj = data.ticket
    var hostname = data.hostname

    ticketSchema.getTicketById(ticketObj._id, function (err, ticket) {
      if (err) return false

      settingsSchema.getSettingsByName(
        [
          'gen:sitetitle',
          'gen:siteurl',
          'gen:customlogo',
          'gen:customlogofilename',
          'color:headerbg',
          'color:headerprimary',
          'tps:enable',
          'tps:username',
          'tps:apikey',
          'gen:siteurl',
          'mailer:enable',
          'beta:email'
        ],
        function (err, settings) {
          if (err) return false

          var genSiteTitle = _.head(_.filter(settings, ['name', 'gen:sitetitle']))
          var genSiteUrl = _.head(_.filter(settings, ['name', 'gen:siteurl']))
          var genCustomLogo = _.head(_.filter(settings, ['name', 'gen:customlogo']))
          var genCustomLogoFilename = _.head(_.filter(settings, ['name', 'gen:customlogofilename']))
          var colorHeaderBG = _.head(_.filter(settings, ['name', 'color:headerbg']))
          var colorHeaderPrimary = _.head(_.filter(settings, ['name', 'color:headerprimary']))
          var tpsEnabled = _.head(_.filter(settings, ['name', 'tps:enable']))
          var tpsUsername = _.head(_.filter(settings, ['name', 'tps:username']))
          var tpsApiKey = _.head(_.filter(settings, ['name', 'tps:apikey']))
          var baseUrl = _.head(_.filter(settings, ['name', 'gen:siteurl'])).value
          var mailerEnabled = _.head(_.filter(settings, ['name', 'mailer:enable']))
          mailerEnabled = !mailerEnabled ? false : mailerEnabled.value

          var betaEnabled = _.head(_.filter(settings, ['name', 'beta:email']))
          betaEnabled = !betaEnabled ? false : betaEnabled.value

          if (!tpsEnabled || !tpsUsername || !tpsApiKey) {
            tpsEnabled = false
          } else {
            tpsEnabled = tpsEnabled.value
            tpsUsername = tpsUsername.value
            tpsApiKey = tpsApiKey.value
          }

          async.parallel(
            [
              function (c) {
                var mailer = require('../mailer')
                var emails = []

                departmentSchema.getDepartmentsByGroup(ticket.group._id, function (err, departments) {
                  if (err) return c(err)
                  if (!departments) return c('Group is not assigned to any departments. Exiting...')

                  var teamMembers = _.flattenDeep(
                    departments.map(function (department) {
                      return department.teams.map(function (team) {
                        return team.members.map(function (member) {
                          return member
                        })
                      })
                    })
                  )

                  var members = _.concat(teamMembers, ticket.group.members)
                  var emailTo = _.concat(teamMembers, ticket.group.sendMailTo)

                  emailTo = _.chain(emailTo)
                    /* .filter(function (i) {
                    return i.email !== ticket.owner.email
                  }) */
                    .map(function (i) {
                      return i.email
                    })
                    .uniq()
                    .value()

                  members = _.uniqBy(members, function (i) {
                    return i._id
                  })

                  async.each(
                    members,
                    function (member, cb) {
                      if (member.deleted) return cb()
                      socketUtils.sendToUser(
                        sharedVars.sockets,
                        sharedVars.usersOnline,
                        member.username,
                        '$trudesk:client:ticket:created',
                        ticket
                      )

                      if (_.isUndefined(member.email) || emailTo.indexOf(member.email) === -1) return cb()

                      emails.push(member.email)
                      return cb()
                    },
                    function (err) {
                      if (err) return c(err)
                      if (!mailerEnabled) return c()

                      emails = _.uniq(emails)

                      var email = null
                      if (betaEnabled) {
                        email = new Email({
                          render: function (view, locals) {
                            return new Promise(function (resolve, reject) {
                              if (!global.Handlebars) return reject(new Error('Could not load global.Handlebars'))
                              templateSchema.findOne({ name: view }, function (err, template) {
                                if (err) return reject(err)
                                if (!template) return reject(new Error('Invalid Template'))
                                var html = global.Handlebars.compile(template.data['gjs-fullHtml'])(locals)
                                email.juiceResources(html).then(resolve)
                              })
                            })
                          }
                        })
                      } else {
                        email = new Email({
                          views: {
                            root: templateDir,
                            options: {
                              extension: 'handlebars'
                            }
                          }
                        })
                      }
                      templateSchema.findOne({ name: 'new-ticket' }, function (err, template) {
                        if (err) return c(err)
                        if (!template) return c()

                        // TODO: hack
                        ticket = {
                          uid: ticket.uid,
                          status: statusToString(ticket.status),
                          subject: ticket.subject,
                          group: {
                            name: ticket.group.name
                          },
                          owner: {
                            fullname: ticket.owner.fullname
                          },
                          date: ticket.date,
                          type: {
                            name: ticket.type.name
                          },
                          priority: {
                            name: ticket.priority.name
                          },
                          tags: ticket.tags.map(tag => ({
                            name: tag.name
                          })),
                          issue: ticket.issue
                        }

                        var context = {
                          settings: {
                            title: genSiteTitle.value,
                            logo:
                              genSiteUrl.value +
                              (genCustomLogo.value
                                ? `/assets/${genCustomLogoFilename.value}`
                                : '/img/defaultLogoDark.png'),
                            colors: {
                              header_background: colorHeaderBG.value,
                              header_primary: colorHeaderPrimary.value
                            }
                          },
                          base_url: baseUrl,
                          ticket: ticket
                        }

                        email
                          .render('new-ticket', context)
                          .then(function (html) {
                            var subjectParsed = global.Handlebars.compile(template.subject)(context)
                            var mailOptions = {
                              to: emails.join(),
                              subject: subjectParsed,
                              html: html,
                              generateTextFromHTML: true
                            }

                            mailer.sendMail(mailOptions, function (err) {
                              if (err) winston.warn('[trudesk:events:ticket:created] - ' + err)

                              winston.debug('Sent [' + emails.length + '] emails.')
                            })

                            return c()
                          })
                          .catch(function (err) {
                            winston.warn('[trudesk:events:ticket:created] - ' + err)
                            return c(err)
                          })
                      })
                    }
                  )
                })
              },
              function (c) {
                if (!ticket.group.public) return c()
                var rolesWithPublic = permissions.getRoles('ticket:public')
                rolesWithPublic = _.map(rolesWithPublic, 'id')
                userSchema.getUsersByRoles(rolesWithPublic, function (err, users) {
                  if (err) return c()
                  var ticketPushClone = _.clone(ticket)
                  async.each(
                    users,
                    function (user, cb) {
                      ticketPushClone.group.sendMailTo.push(user._id)
                      return saveNotification(user, ticket, cb)
                    },
                    function (err) {
                      sendPushNotification(
                        {
                          tpsEnabled: tpsEnabled,
                          tpsUsername: tpsUsername,
                          tpsApiKey: tpsApiKey,
                          hostname: hostname || baseUrl
                        },
                        { type: 1, ticket: ticketPushClone }
                      )

                      return c(err)
                    }
                  )
                })
              },
              function (c) {
                // Public Ticket Notification is handled above.
                if (ticket.group.public) return c()

                departmentSchema.getDepartmentsByGroup(ticket.group._id, function (err, departments) {
                  if (err) return c(err)
                  if (!departments) return c('Group is not assigned to any departments. Exiting...')

                  var members = _.flattenDeep(
                    departments.map(function (department) {
                      return department.teams.map(function (team) {
                        return team.members.map(function (member) {
                          return member
                        })
                      })
                    })
                  )

                  members = _.concat(members, ticket.group.members)

                  members = _.uniqBy(members, function (i) {
                    return i._id
                  })

                  async.each(
                    members,
                    function (member, cb) {
                      if (_.isUndefined(member)) return cb()

                      return saveNotification(member, ticket, cb)
                    },
                    function (err) {
                      sendPushNotification(
                        {
                          tpsEnabled: tpsEnabled,
                          tpsUsername: tpsUsername,
                          tpsApiKey: tpsApiKey,
                          hostname: hostname || baseUrl
                        },
                        { type: 1, ticket: ticket }
                      )

                      return c(err)
                    }
                  )
                })
              }
            ],
            function (err) {
              if (err) {
                return winston.warn('[trudesk:events:ticket:created] - Error: ' + err)
              }

              // Send Ticket..
              util.sendToAllConnectedClients(io, 'ticket:created', ticket)
            }
          )
        }
      )
    })
  })

  function sendPushNotification (tpsObj, data) {
    var tpsEnabled = tpsObj.tpsEnabled
    var tpsUsername = tpsObj.tpsUsername
    var tpsApiKey = tpsObj.tpsApiKey
    var hostname = tpsObj.hostname
    var ticket = data.ticket
    var message = data.message

    if (!tpsEnabled || !tpsUsername || !tpsApiKey) {
      winston.debug('Warn: TPS - Push Service Not Enabled')
      return
    }

    if (!hostname) {
      winston.debug('Could not get hostname for push: ' + data.type)
      return
    }

    // Data
    // 1 - Ticket Created
    // 2 - Ticket Comment Added
    // 3 - Ticket Note Added
    // 4 - Ticket Assignee Set
    //  - Message
    var title
    var users = []
    var content
    switch (data.type) {
      case 1:
        title = 'Ticket #' + ticket.uid + ' Created'
        content = ticket.owner.fullname + ' submitted a ticket'
        users = _.map(ticket.group.sendMailTo, function (o) {
          return o._id
        })
        break
      case 2:
        title = 'Ticket #' + ticket.uid + ' Updated'
        content = _.last(ticket.history).description
        var comment = _.last(ticket.comments)
        users = _.compact(
          _.map(ticket.subscribers, function (o) {
            if (comment.owner._id.toString() !== o._id.toString()) {
              return o._id
            }
          })
        )
        break
      case 3:
        title = message.owner.fullname + ' sent you a message'
        break
      case 4:
        var assigneeId = data.assigneeId
        var ticketUid = data.ticketUid
        ticket = {}
        ticket._id = data.ticketId
        ticket.uid = data.ticketUid
        title = 'Assigned to Ticket #' + ticketUid
        content = 'You were assigned to Ticket #' + ticketUid
        users = [assigneeId]
        break
      default:
        title = ''
    }

    if (_.size(users) < 1) {
      winston.debug('No users to push too | UserSize: ' + _.size(users))
      return
    }

    var n = {
      title: title,
      data: {
        ticketId: ticket._id,
        ticketUid: ticket.uid,
        users: users,
        hostname: hostname
      }
    }

    if (content) {
      n.content = content
    }

    notifications.pushNotification(tpsUsername, tpsApiKey, n)
  }

  function saveNotification (user, ticket, callback) {
    var notification = new NotificationSchema({
      owner: user,
      title: 'Ticket #' + ticket.uid + ' Created',
      message: ticket.subject,
      type: 0,
      data: { ticket: ticket },
      unread: true
    })

    notification.save(function (err) {
      if (_.isFunction(callback)) {
        return callback(err)
      }
    })
  }

  emitter.on('ticket:updated', function (ticket) {
    io.sockets.emit('$trudesk:client:ticket:updated', { ticket: ticket })

    if (!ticket.skipUpdatedMail) {
      settingsSchema.getSettingsByName(
        [
          'gen:sitetitle',
          'gen:siteurl',
          'gen:customlogo',
          'gen:customlogofilename',
          'color:headerbg',
          'color:headerprimary',
          'tps:enable',
          'tps:username',
          'tps:apikey',
          'mailer:enable'
        ],
        function (err, settings) {
          if (err) return false

          var genSiteTitle = _.head(_.filter(settings, ['name', 'gen:sitetitle']))
          var genSiteUrl = _.head(_.filter(settings, ['name', 'gen:siteurl']))
          var genCustomLogo = _.head(_.filter(settings, ['name', 'gen:customlogo']))
          var genCustomLogoFilename = _.head(_.filter(settings, ['name', 'gen:customlogofilename']))
          var colorHeaderBG = _.head(_.filter(settings, ['name', 'color:headerbg']))
          var colorHeaderPrimary = _.head(_.filter(settings, ['name', 'color:headerprimary']))
          var tpsEnabled = _.head(_.filter(settings, ['name', 'tps:enable']))
          var tpsUsername = _.head(_.filter(settings, ['name', 'tps:username']))
          var tpsApiKey = _.head(_.filter(settings), ['name', 'tps:apikey'])
          var mailerEnabled = _.head(_.filter(settings), ['name', 'mailer:enable'])
          mailerEnabled = !mailerEnabled ? false : mailerEnabled.value

          if (!tpsEnabled || !tpsUsername || !tpsApiKey) {
            tpsEnabled = false
          } else {
            tpsEnabled = tpsEnabled.value
            tpsUsername = tpsUsername.value
            tpsApiKey = tpsApiKey.value
          }

          async.parallel(
            [
              // Send email to subscribed users
              function (c) {
                if (!mailerEnabled) return c()

                var mailer = require('../mailer')
                var emails = []
                async.each(
                  ticket.subscribers,
                  function (member, cb) {
                    if (_.isUndefined(member) || _.isUndefined(member.email)) return cb()
                    if (member.deleted) return cb()

                    emails.push(member.email)

                    cb()
                  },
                  function (err) {
                    if (err) return c(err)

                    emails = _.uniq(emails)

                    if (_.size(emails) < 1) {
                      return c()
                    }

                    var email = new Email({
                      views: {
                        root: templateDir,
                        options: {
                          extension: 'handlebars'
                        }
                      }
                    })

                    // TODO: hack
                    ticket = {
                      uid: ticket.uid,
                      status: statusToString(ticket.status),
                      subject: ticket.subject,
                      group: {
                        name: ticket.group.name
                      },
                      owner: {
                        fullname: ticket.owner.fullname
                      },
                      date: ticket.date,
                      type: {
                        name: ticket.type.name
                      },
                      priority: {
                        name: ticket.priority.name
                      },
                      tags: ticket.tags.map(tag => ({
                        name: tag.name
                      })),
                      issue: ticket.issue
                    }

                    var context = {
                      settings: {
                        title: genSiteTitle.value,
                        logo:
                          genSiteUrl.value +
                          (genCustomLogo.value ? `/assets/${genCustomLogoFilename.value}` : '/img/defaultLogoDark.png'),
                        colors: {
                          header_background: colorHeaderBG.value,
                          header_primary: colorHeaderPrimary.value
                        }
                      },
                      ticket: ticket
                    }

                    email
                      .render('ticket-updated', context)
                      .then(function (html) {
                        var mailOptions = {
                          to: emails.join(),
                          subject: 'Updated: Ticket #' + ticket.uid + '-' + ticket.subject,
                          html: html,
                          generateTextFromHTML: true
                        }

                        mailer.sendMail(mailOptions, function (err) {
                          if (err) winston.warn('[trudesk:events:sendSubscriberEmail] - ' + err)

                          winston.debug('Sent [' + emails.length + '] emails.')
                        })

                        return c()
                      })
                      .catch(function (err) {
                        winston.warn('[trudesk:events:sendSubscriberEmail] - ' + err)
                        return c(err)
                      })
                  }
                )
              }
            ],
            function () {
              // Blank
            }
          )
        }
      )
    }
  })

  emitter.on('ticket:deleted', function (oId) {
    io.sockets.emit('ticket:delete', oId)
    io.sockets.emit('$trudesk:client:ticket:deleted', oId)
  })

  emitter.on('ticket:subscriber:update', function (data) {
    io.sockets.emit('ticket:subscriber:update', data)
  })

  emitter.on('ticket:comment:added', function (ticket, comment, hostname) {
    // Goes to client
    io.sockets.emit('updateComments', ticket)

    settingsSchema.getSettingsByName(
      [
        'gen:sitetitle',
        'gen:siteurl',
        'gen:customlogo',
        'gen:customlogofilename',
        'color:headerbg',
        'color:headerprimary',
        'tps:enable',
        'tps:username',
        'tps:apikey',
        'mailer:enable'
      ],
      function (err, settings) {
        if (err) return false

        var genSiteTitle = _.head(_.filter(settings, ['name', 'gen:sitetitle']))
        var genSiteUrl = _.head(_.filter(settings, ['name', 'gen:siteurl']))
        var genCustomLogo = _.head(_.filter(settings, ['name', 'gen:customlogo']))
        var genCustomLogoFilename = _.head(_.filter(settings, ['name', 'gen:customlogofilename']))
        var colorHeaderBG = _.head(_.filter(settings, ['name', 'color:headerbg']))
        var colorHeaderPrimary = _.head(_.filter(settings, ['name', 'color:headerprimary']))
        var tpsEnabled = _.head(_.filter(settings, ['name', 'tps:enable']))
        var tpsUsername = _.head(_.filter(settings, ['name', 'tps:username']))
        var tpsApiKey = _.head(_.filter(settings), ['name', 'tps:apikey'])
        var mailerEnabled = _.head(_.filter(settings), ['name', 'mailer:enable'])
        mailerEnabled = !mailerEnabled ? false : mailerEnabled.value

        if (!tpsEnabled || !tpsUsername || !tpsApiKey) {
          tpsEnabled = false
        } else {
          tpsEnabled = tpsEnabled.value
          tpsUsername = tpsUsername.value
          tpsApiKey = tpsApiKey.value
        }

        async.parallel(
          [
            function (cb) {
              if (ticket.owner._id.toString() === comment.owner.toString()) return cb
              if (!_.isUndefined(ticket.assignee) && ticket.assignee._id.toString() === comment.owner.toString())
                return cb

              var notification = new NotificationSchema({
                owner: ticket.owner,
                title: 'Comment Added to Ticket#' + ticket.uid,
                message: ticket.subject,
                type: 1,
                data: { ticket: ticket },
                unread: true
              })

              notification.save(function (err) {
                return cb(err)
              })
            },
            function (cb) {
              if (_.isUndefined(ticket.assignee)) return cb()
              if (ticket.assignee._id.toString() === comment.owner.toString()) return cb
              if (ticket.owner._id.toString() === ticket.assignee._id.toString()) return cb()

              var notification = new NotificationSchema({
                owner: ticket.assignee,
                title: 'Comment Added to Ticket#' + ticket.uid,
                message: ticket.subject,
                type: 2,
                data: { ticket: ticket },
                unread: true
              })

              notification.save(function (err) {
                return cb(err)
              })
            },
            function (cb) {
              sendPushNotification(
                {
                  tpsEnabled: tpsEnabled,
                  tpsUsername: tpsUsername,
                  tpsApiKey: tpsApiKey,
                  hostname: hostname
                },
                { type: 2, ticket: ticket }
              )
              return cb()
            },
            // Send email to subscribed users
            function (c) {
              if (!mailerEnabled) return c()

              var mailer = require('../mailer')
              var emails = []
              async.each(
                ticket.subscribers,
                function (member, cb) {
                  if (_.isUndefined(member) || _.isUndefined(member.email)) return cb()
                  if (member._id.toString() === comment.owner.toString()) return cb()
                  if (member.deleted) return cb()

                  emails.push(member.email)

                  cb()
                },
                function (err) {
                  if (err) return c(err)

                  emails = _.uniq(emails)

                  if (_.size(emails) < 1) {
                    return c()
                  }

                  var email = new Email({
                    views: {
                      root: templateDir,
                      options: {
                        extension: 'handlebars'
                      }
                    }
                  })

                  ticket.populate('comments.owner', function (err, ticket) {
                    if (err) winston.warn(err)
                    if (err) return c()

                    // TODO: hack
                    ticket = {
                      uid: ticket.uid,
                      status: statusToString(ticket.status),
                      subject: ticket.subject,
                      group: {
                        name: ticket.group.name
                      },
                      owner: {
                        fullname: ticket.owner.fullname
                      },
                      date: ticket.date,
                      type: {
                        name: ticket.type.name
                      },
                      priority: {
                        name: ticket.priority.name
                      },
                      tags: ticket.tags.map(tag => ({
                        name: tag.name
                      })),
                      issue: ticket.issue,
                      comments: ticket.comments.map(comment => ({
                        owner: {
                          fullname: comment.owner.fullname
                        },
                        date: comment.date,
                        comment: comment.comment
                      }))
                    }

                    var context = {
                      settings: {
                        title: genSiteTitle.value,
                        logo:
                          genSiteUrl.value +
                          (genCustomLogo.value ? `/assets/${genCustomLogoFilename.value}` : '/img/defaultLogoDark.png'),
                        colors: {
                          header_background: colorHeaderBG.value,
                          header_primary: colorHeaderPrimary.value
                        }
                      },
                      ticket: ticket,
                      comment: comment
                    }

                    email
                      .render('ticket-comment-added', context)
                      .then(function (html) {
                        var mailOptions = {
                          to: emails.join(),
                          subject: 'Updated: Ticket #' + ticket.uid + '-' + ticket.subject,
                          html: html,
                          generateTextFromHTML: true
                        }

                        mailer.sendMail(mailOptions, function (err) {
                          if (err) winston.warn('[trudesk:events:sendSubscriberEmail] - ' + err)

                          winston.debug('Sent [' + emails.length + '] emails.')
                        })

                        return c()
                      })
                      .catch(function (err) {
                        winston.warn('[trudesk:events:sendSubscriberEmail] - ' + err)
                        return c(err)
                      })
                  })
                }
              )
            }
          ],
          function () {
            // Blank
          }
        )
      }
    )
  })

  emitter.on('ticket:setAssignee', function (data) {
    settingsSchema.getSettingsByName(['tps:enable', 'tps:username', 'tps:apikey'], function (err, tpsSettings) {
      if (err) return false

      var tpsEnabled = _.head(_.filter(tpsSettings, ['name', 'tps:enable']))
      var tpsUsername = _.head(_.filter(tpsSettings, ['name', 'tps:username']))
      var tpsApiKey = _.head(_.filter(tpsSettings), ['name', 'tps:apikey'])

      if (!tpsEnabled || !tpsUsername || !tpsApiKey) {
        tpsEnabled = false
      } else {
        tpsEnabled = tpsEnabled.value
        tpsUsername = tpsUsername.value
        tpsApiKey = tpsApiKey.value
      }

      if (!tpsEnabled) return

      sendPushNotification(
        {
          tpsEnabled: tpsEnabled,
          tpsUsername: tpsUsername,
          tpsApiKey: tpsApiKey,
          hostname: data.hostname
        },
        {
          type: 4,
          ticketId: data.ticketId,
          ticketUid: data.ticketUid,
          assigneeId: data.assigneeId
        }
      )
    })
  })

  emitter.on('ticket:note:added', function (ticket, note, hostname) {
    // Goes to client
    io.sockets.emit('updateNotes', ticket)

    settingsSchema.getSettingsByName(
      [
        'gen:sitetitle',
        'gen:siteurl',
        'gen:customlogo',
        'gen:customlogofilename',
        'color:headerbg',
        'color:headerprimary',
        'tps:enable',
        'tps:username',
        'tps:apikey',
        'mailer:enable'
      ],
      function (err, settings) {
        if (err) return false

        var genSiteTitle = _.head(_.filter(settings, ['name', 'gen:sitetitle']))
        var genSiteUrl = _.head(_.filter(settings, ['name', 'gen:siteurl']))
        var genCustomLogo = _.head(_.filter(settings, ['name', 'gen:customlogo']))
        var genCustomLogoFilename = _.head(_.filter(settings, ['name', 'gen:customlogofilename']))
        var colorHeaderBG = _.head(_.filter(settings, ['name', 'color:headerbg']))
        var colorHeaderPrimary = _.head(_.filter(settings, ['name', 'color:headerprimary']))
        var tpsEnabled = _.head(_.filter(settings, ['name', 'tps:enable']))
        var tpsUsername = _.head(_.filter(settings, ['name', 'tps:username']))
        var tpsApiKey = _.head(_.filter(settings), ['name', 'tps:apikey'])
        var mailerEnabled = _.head(_.filter(settings), ['name', 'mailer:enable'])
        mailerEnabled = !mailerEnabled ? false : mailerEnabled.value

        if (!tpsEnabled || !tpsUsername || !tpsApiKey) {
          tpsEnabled = false
        } else {
          tpsEnabled = tpsEnabled.value
          tpsUsername = tpsUsername.value
          tpsApiKey = tpsApiKey.value
        }

        async.parallel(
          [
            function (cb) {
              if (ticket.owner._id.toString() === note.owner._id.toString()) return cb
              if (!_.isUndefined(ticket.assignee) && ticket.assignee._id.toString() === note.owner._id.toString())
                return cb

              var notification = new NotificationSchema({
                owner: ticket.owner,
                title: 'Note Added to Ticket#' + ticket.uid,
                message: ticket.subject,
                type: 1,
                data: { ticket: ticket },
                unread: true
              })

              notification.save(function (err) {
                return cb(err)
              })
            },
            function (cb) {
              if (_.isUndefined(ticket.assignee)) return cb()
              if (ticket.assignee._id.toString() === ticket.owner._id.toString()) return cb
              if (ticket.owner._id.toString() === ticket.assignee._id.toString()) return cb()

              var notification = new NotificationSchema({
                owner: ticket.assignee,
                title: 'Note Added to Ticket#' + ticket.uid,
                message: ticket.subject,
                type: 2,
                data: { ticket: ticket },
                unread: true
              })

              notification.save(function (err) {
                return cb(err)
              })
            },
            function (cb) {
              sendPushNotification(
                {
                  tpsEnabled: tpsEnabled,
                  tpsUsername: tpsUsername,
                  tpsApiKey: tpsApiKey,
                  hostname: hostname
                },
                { type: 2, ticket: ticket }
              )
              return cb()
            },
            // Send email to subscribed users
            function (c) {
              if (!mailerEnabled) return c()

              var mailer = require('../mailer')
              var emails = []
              async.each(
                ticket.subscribers,
                function (member, cb) {
                  if (_.isUndefined(member) || _.isUndefined(member.email)) return cb()
                  if (member._id.toString() === note.owner._id.toString()) return cb()
                  if (!member.role.isAgent) return cb()
                  if (member.deleted) return cb()

                  emails.push(member.email)

                  cb()
                },
                function (err) {
                  if (err) return c(err)

                  emails = _.uniq(emails)

                  if (_.size(emails) < 1) {
                    return c()
                  }

                  var email = new Email({
                    views: {
                      root: templateDir,
                      options: {
                        extension: 'handlebars'
                      }
                    }
                  })

                  ticket.populate('notes.owner', function (err, ticket) {
                    if (err) winston.warn(err)
                    if (err) return c()

                    // TODO: hack
                    ticket = {
                      uid: ticket.uid,
                      status: statusToString(ticket.status),
                      subject: ticket.subject,
                      group: {
                        name: ticket.group.name
                      },
                      owner: {
                        fullname: ticket.owner.fullname
                      },
                      date: ticket.date,
                      type: {
                        name: ticket.type.name
                      },
                      priority: {
                        name: ticket.priority.name
                      },
                      tags: ticket.tags.map(tag => ({
                        name: tag.name
                      })),
                      issue: ticket.issue,
                      notes: ticket.notes.map(note => ({
                        owner: {
                          fullname: note.owner.fullname
                        },
                        date: note.date,
                        note: note.note
                      }))
                    }

                    var context = {
                      settings: {
                        title: genSiteTitle.value,
                        logo:
                          genSiteUrl.value +
                          (genCustomLogo.value ? `/assets/${genCustomLogoFilename.value}` : '/img/defaultLogoDark.png'),
                        colors: {
                          header_background: colorHeaderBG.value,
                          header_primary: colorHeaderPrimary.value
                        }
                      },
                      ticket: ticket,
                      note: note
                    }

                    email
                      .render('ticket-note-added', context)
                      .then(function (html) {
                        var mailOptions = {
                          to: emails.join(),
                          subject: 'Updated: Ticket #' + ticket.uid + '-' + ticket.subject,
                          html: html,
                          generateTextFromHTML: true
                        }

                        mailer.sendMail(mailOptions, function (err) {
                          if (err) winston.warn('[trudesk:events:sendSubscriberEmail] - ' + err)

                          winston.debug('Sent [' + emails.length + '] emails.')
                        })

                        return c()
                      })
                      .catch(function (err) {
                        winston.warn('[trudesk:events:sendSubscriberEmail] - ' + err)
                        return c(err)
                      })
                  })
                }
              )
            }
          ],
          function () {
            // Blank
          }
        )
      }
    )
  })

  emitter.on('trudesk:profileImageUpdate', function (data) {
    io.sockets.emit('trudesk:profileImageUpdate', data)
  })

  emitter.on('$trudesk:flushRoles', function () {
    require('../permissions').register(function () {
      io.sockets.emit('$trudesk:flushRoles')
    })
  })
})()

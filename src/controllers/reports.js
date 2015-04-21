/**
      .                              .o8                     oooo
   .o8                             "888                     `888
 .o888oo oooo d8b oooo  oooo   .oooo888   .ooooo.   .oooo.o  888  oooo
   888   `888""8P `888  `888  d88' `888  d88' `88b d88(  "8  888 .8P'
   888    888      888   888  888   888  888ooo888 `"Y88b.   888888.
   888 .  888      888   888  888   888  888    .o o.  )88b  888 `88b.
   "888" d888b     `V88V"V8P' `Y8bod88P" `Y8bod8P' 8""888P' o888o o888o
 ========================================================================
 Created:    03/27/2015
 Author:     Chris Brame

 **/

var async           = require('async');
var _               = require('underscore');
var _s              = require('underscore.string');
var flash           = require('connect-flash');
var userSchema      = require('../models/user');
var reportSchema     = require('../models/report');
var permissions     = require('../permissions');
var mongoose        = require('mongoose');

var reportsController = {};

reportsController.content = {};

reportsController.get = function(req, res, next) {
    var user = req.user;
    if (_.isUndefined(user) || !permissions.canThis(user.role, 'reports:view')) {
        req.flash('message', 'Permission Denied.');
        return res.redirect('/');
    }

    var self = this;
    self.content = {};
    self.content.title = "Reports";
    self.content.nav = 'reports';

    self.content.data = {};
    self.content.data.user = req.user;
    self.content.data.common = req.viewdata;
    self.content.data.groups = {};

    res.render('reports', self.content);
};

function handleError(res, err) {
    if (err) {
        return res.render('error', {layout: false, error: err, message: err.message});
    }
}

module.exports = reportsController;
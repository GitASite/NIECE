
let config = {
  port: 4430,
  site: {
    title: 'NIECE',
    email: 'hi@box.biz'
  },
  publicUploadDirectory: 'content/public',
  publicUploadMediaDirectory: '/media/',
  databaseDirectory: './db',
  usersRequireVerification: true,
  redirectionAfterLogin: '/user',
  passwordUpdateTokenExpiration: '1h',
  passwordHashSize: 10
}

let scope;

const express = require("express");
const app = express();
const fs = require('fs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const { getRoutes } = require('get-routes');
const flash = require('express-flash');
const session = require('express-session');
const methodOverride = require('method-override');
const fileUpload = require('express-fileupload');
const pathMod = require('path');
const dateFormat = require('dateformat');
const _ = require('lodash');
const Handlebars = require('handlebars');
const prettifyHTML = require('pretti');

class NieceCore {
  
  contentSave(req, res) {
    if (!req.user) {
      req.flash('error', 'You don\'t have access.');
      return res.redirect(req.body.route || '/');
    }
    if (req.user.role != 'admin') {
      req.flash('error', 'You don\'t have access.');
      return res.redirect(req.body.route || '/');
    }
    // Process markup
    let markup = Niece.preserveHandlebars(req.body.markup);
    markup = prettifyHTML(markup);
    // New Content
    if ((req.body.new == 'true' || req.body.new == true) && req.body.route != req.body.new_route) {
      const key = req.body.title.toLowerCase().replace(/[^a-z0-9 ]*/g, '').replace(/\s{1,}/, '-');
      fs.writeFile(`./content/${req.body.template}--${key}.handlebars`, markup, { flag: 'w' }, err => {
        if (err) {
          req.flash('error', `An error occured. ${err.name}: ${err.message}`);
          return res.redirect(req.body.route || '/');
        }
        if (!Array.isArray(req.body.menu)) req.body.menu = [req.body.menu];
        const menu = req.body.menu && req.body.menu.length ? req.body.menu.join(' ') : null;
        scope.db.routes.insert({...Niece.routeTemplate, path: req.body.new_route, link: req.body.title, menu: menu, template: 'page'}, (_err, row)=>{
          scope.updateRoutes();
          req.flash('info', 'Content has been created.');
          res.redirect(req.body.new_route || '/');
        });
      });
      return;
    }
    // Exit content
    fs.writeFile(`./content/${req.body.template}.handlebars`, markup, { flag: 'w' }, err => {
      if (err) {
        req.flash('error', `An error occured. ${err.name}: ${err.message}`);
        return res.redirect(req.body.route || '/');
      }
      req.body.menu = typeof req.body.menu === 'undefined' || req.body.menu === null ? [] : req.body.menu;
      if (typeof req.body.menu === 'string') req.body.menu = req.body.menu.split(' ');
      if (!Array.isArray(req.body.menu)) req.body.menu = [];
      req.body.orig_menu = req.body.orig_menu.split(' ');
      
      const pathChanged = req.body.route != req.body.new_route;
      const menuChanged = req.body.menu.sort().join(' ') != req.body.orig_menu.sort().join(' ');
      
      if ( pathChanged || menuChanged ) {
        
        scope.db.routes.findOne({path: req.body.route}, (err, route)=>{
          
          if (err) {
            req.flash('error', err.message);
            res.redirect(req.body.route || '/');
            return;
          }
          
          let updatedRoute;
          
          if (req.body.route != '/' && req.body.new_route != '/' && pathChanged) {
            updatedRoute = {...route};
            updatedRoute.path = req.body.new_route;
            app.get(req.body.route, ()=>{
              res.redirect(updatedRoute.path || '/');
            });
          }
          
          if (menuChanged) {
            if (!updatedRoute) updatedRoute = {...route};
            updatedRoute.menu = req.body.menu.sort().join(' ');
          }
          
          if (updatedRoute) {
            scope.db.routes.update({_id: route._id}, updatedRoute, (err, route)=>{
              scope.updateRoutes();
              req.flash('info', 'Content has been updated.');
              res.redirect(updatedRoute.path || '/');
            });
            return;
          }
          
          req.flash('info', 'Content has been updated.');
          res.redirect(req.body.route || '/');
          
        });
        
        return;
        
      }
      
      req.flash('info', 'Content has been updated.');
      res.redirect(req.body.route || '/');
      
    });
  }
  
}

class Niece extends NieceCore {
  
  //db: { routes, users }
  //modules = { user, routes }
  
  constructor( _config ) {
    
    super(_config);
    
    scope = this;
    
    // Update the config from niece.json file
    const f_config = Niece.require('niece.json');
    if (f_config) _.merge(config, f_config);
    
    // Update the config from argument.
    _config = _config || {};
    _.merge(config, _config);
    
    // Make sure our env exists, otherwise generate it.
    fs.writeFile('./.env', `NIECE_SECRET=${Niece.generatePassword()}`, { flag: 'wx' }, err => {
      if (process.env.NODE_ENV !== 'production') require('dotenv').config();
      scope.init();
      scope.listen();
    });
  
  }
  
  
  static get userTemplate() {
    return { id: null, name: null, email: null, password: null, verified: null, role: null, joined: null };
  }
  
  static get routeTemplate() {
    return { path: null, link: null, menu: null, weight: 0, template: null, callback: null, middleware: null, active: 1 };
  }
  
  
  init() {
    
    const scope = this;
    
    // Create DB
    scope.initializeDB();
    
    // Initialize Template System
    scope.initializeTemplates();
    
    // Init Application
    scope.initializeApp();
    
    // initializeModules
    scope.initializeModules();
    
    // Initialize passport
    scope.initializePassport(
      passport,
      (email, done) => { scope.db.users.findOne({email: email}, (err, user) => done(user)) },
      (id, done) => { scope.db.users.findOne({id: id}, (err, user) => done(user)) }
    );
    
    // Initiated routes
    scope.initializeRoutes();
    
  }
  
  
  initializeDB() {
    const dir = config.databaseDirectory;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    const DBEngine = require('tingodb')();
    const db = new DBEngine.Db(config.databaseDirectory, {});
    scope.db = {
      routes: db.collection('routes'),
      users: db.collection('users')
    }
  }
  
  
  initializePassport(passport, getUserByEmail, getUserById) {
    const LocalStrategy = require('passport-local').Strategy;
    const authenticateUser = async (email, password, done) => {
      getUserByEmail(email, async user=>{
        if (user == null) {
          return done(null, false, { message: 'No user with that email' })
        }
        try {
          if (await bcrypt.compare(password, user.password)) {
            return done(null, user)
          } else {
            return done(null, false, { message: 'Password incorrect' })
          }
        } catch (e) {
          return done(e)
        }
      })
    }
    passport.use(new LocalStrategy({ usernameField: 'email' }, authenticateUser))
    passport.serializeUser((user, done) => done(null, user.id))
    passport.deserializeUser((id, done) => {
      getUserById(id, user=>{
        done(null, user)
      })
    })
  }
  
  
  initializeRoutes() {
    scope.db.routes.findOne({path:'/'}, (err, item) => {
      if ( !item ) scope.install();
      else scope.updateRoutes();
      scope.setupLoginRoutes();
    });
  }
  
  
  listen() {
    app.listen(config.port, () => {
      console.log(`NIECE App listening at port ${config.port}`);
    })
  }
    
  
  initializeTemplates() {
    const exphbs  = require('express-handlebars');
    const hbs = exphbs.create({});
    const customDir = './content/';
    const customPublicDir = 'public/';
    const customPublicMediaDir = 'media/';
    if (!fs.existsSync(customDir)) fs.mkdirSync(customDir);
    if (!fs.existsSync(customDir+customPublicDir))
      fs.mkdirSync(customDir+customPublicDir);
    if (!fs.existsSync(customDir+customPublicDir+customPublicMediaDir))
      fs.mkdirSync(customDir+customPublicDir+customPublicMediaDir);
    app.set('views', pathMod.join(__dirname, '/views'));
    app.use((req, res, next) => {
      app.engine('handlebars', exphbs({
        extname: '.handlebars',
        helpers: scope.getTemplateHandlers(req.originalUrl),
        partialsDir: [
          pathMod.join(__dirname, '/views/partials/'),
          customDir
        ]
      }));
      app.set('view engine', 'handlebars');
      next();
    });
  }
  
  
  initializeApp() {
    app.use(express.static(pathMod.join(__dirname, '/public')));
    app.use(express.static('content/public'));
    app.use(express.static('node_modules/tinymce'));
    app.use(express.static('node_modules/tinymce/icons/default'));
    app.use(fileUpload());
    app.use(express.urlencoded({ extended: false }));
    app.use(flash());
    app.use(session({
      secret: process.env.NIECE_SECRET,
      resave: false,
      saveUninitialized: false
    }));
    app.use(passport.initialize());
    app.use(passport.session());
    app.use(methodOverride('_method'));
  }
    
    
    
  initializeModules() {
    scope.modules = {
      user: {
        pageUserEditPreprocess: async (vars, req) => {
          vars.changePasswordToken = await jwt.sign({
            email: vars.user.email
          }, process.env.NIECE_SECRET, {
            expiresIn: config.passwordUpdateTokenExpiration
          });
          return;
        },
        pageUserUpdate_passwordPreprocess: async (vars, req) => {
          vars.changePasswordToken = req.query.token;
          return;
        },
        pageUsersPreprocess: async (vars, req) => {
          vars.query = req.query;
          const find = async query => {
            return new Promise(resolve => {
              scope.db.users.find(query, async (err, cursor) => {
                const toArray = async () => {
                  return new Promise(resolve2 => {
                    cursor.toArray((err, users)=>{
                      vars.users = users;
                      resolve();
                      resolve2();
                    });
                  })
                };
                await toArray();
                
              });
            });
          }
          const query = {};
          for( let key in req.query )  {
            if ( key == 'sort' ) continue;
            let val = req.query[key].replace(/^\s*|s*$/g, '');
            if ( val == '' ) continue;
            query[key] = val;
          }
          await find(query);
          return;
        },
        pageUsers__userIDPreprocess: async (vars, req) => {
          const findOne = async query => {
            return new Promise(resolve => {
              scope.db.users.findOne(query, async (err, profile) => {
                vars.profile = profile;
                resolve();
              });
            });
          }
          await findOne({_id: parseInt(req.params.userID) + 1});
          return;
        }
      }
    };
  }
  
  getTemplateHandlers(routePath) {
    return {
      navItemActive: function( path ){
        path = path.split('?')[0];
        routePath = routePath.split('?')[0];
        const active = 'active';
        if ( path.split(/\s*\|\s*/g).includes(routePath) ) return active;
        return '';
      },
      selectItemActive: function( val, val2 ){
        if ( !val || !val2 ) return '';
        const selected = 'selected';
        if ( val.replace(/^\s*|\s*$/g, '') == val2.replace(/^\s*|\s*$/g, '') ) return selected;
        return '';
      },
      ifempty: function( val ){
        if ( !val || (typeof val === 'string' && val.replace(/^\s*|\s*$/g, '') == '') ) {
          return options.fn(this);
        }
        return options.inverse(this);
      },
      ifeq: function(a, b, options){
        if (a === b) {
          return options.fn(this);
        }
        return options.inverse(this);
      },
      ifnoteq: function(a, b, options){
        if (a !== b) {
          return options.fn(this);
        }
        return options.inverse(this);
      },
      ifeval: function(code, arg, options) {
        const result = eval(code);
        if (eval(code)) {
          return options.fn(this);
        }
        return options.inverse(this);
      },
      dateformat: function(format, timestamp){
        // https://blog.stevenlevithan.com/archives/date-time-format
        let dateString;
        try {
          dateString = dateFormat(new Date(timestamp), format);
        } catch(e){ console.error('templateHelpers:dateformat had an error. Timestamp: ' + timestamp); }
        if (!dateString) return '';
        return dateString;
      },
      minus: function(subtract, number){
        return parseInt(number) - parseInt(subtract);
      },
      plus: function(plus, number){
        return parseInt(number) + parseInt(plus);
      },
      mult: function(mult, number){
        return parseInt(number) * parseInt(mult);
      },
      divide: function(divide, number){
        return parseInt(number) / parseInt(divide);
      },
      icon: function(text, path, srOnly, size){
        return new Handlebars.SafeString(scope.getIcon(text, path, srOnly, size));
      }
    }
  }
  
    
  getSiteSettings() {
    const date = new Date();
    const vars = {
      ...config,
      page: {
        title: null,
        key: null,
        template: null
      },
      date: {
        fullYear: date.getFullYear()
      },
      user: null
    }
    return vars;
  }
  
  
  static require(path, cb) {
    let required;
    cb = cb || (()=>{});
    path = '../../' + path.replace(/^[\.\/]{2,}/, '');
    try {
      required = require(path);
    } catch (e) {
      if (e instanceof Error) cb(e, required);
    }
    if (required) cb(null, required) ;
    return required;
  }
  
  
  getIcons() {
    let icons = {
      "/": "bi-house-fill",
      "/user": "bi-person-fill",
      "#admin": "bi-gear-fill",
      "#edit": "bi-pencil-fill",
      "/user/login": "bi-box-arrow-right",
      "/user/logout": "bi-box-arrow-left",
      "/user/register": "bi-person-plus-fill",
      "/users": "bi-person-lines-fill",
      "/user/edit": "bi-person-edit-fill",
      "/content": "bi-list-task",
      "/page/new": "bi-pencil-square"
    };
    const moreIcons = Niece.require('icons.json');
    if ( moreIcons ) _.merge(icons, moreIcons);
    return icons;
  }
  
  
  getIcon(text, path, srOnly) {
    const icons = scope.getIcons();
    if ( typeof icons[path] === 'string' ) {
      if ( srOnly ) return `<i class="bi ${icons[path]}"></i> <span class="sr-only">${text}</span>`;
      return `<i class="bi ${icons[path]}"></i> ${text}`;
    }
    return text;
  }
  
  
  async getMenus(req, cb) {
    const menus = [];
    const findMenu = async menuName => {
      return new Promise(resolve => {
        scope.db.routes.find({ menu: new RegExp(menuName)}, async (err, menu) => {
          menu.toArray((ArrErr, arr)=>{
            const menuItems = [];
            if (arr) arr.forEach((item, index)=>{
              if ( item.menu.split(' ').indexOf(menuName) == -1 ) return;
              if ( item.middleware && !scope[item.middleware](req) ) return;
              menuItems.push(item);
            });
            menus[menuName] = menuItems;
            resolve();
          });
        });
      });
    }
    await findMenu('main');
    await findMenu('user');
    await findMenu('user_admin');
    await findMenu('footer');
    await findMenu('admin');
    if ( typeof cb === 'function' ) cb.call(scope, menus);
    return menus;
  }
  
  
  updateRoutes() {
    scope.db.routes.find({active: 1}).toArray((err, rows)=>{
      const date = new Date();
      const vars = async (row, req) => {
        const vars = {...scope.getSiteSettings()};
        if (!row) {
          console.error('Row is null');
          return vars;
        }
        // Set page variables...
        if (row.path == '/page/new') row.link = null;
        // Page title is the row.link
        if ( row && row.link ) vars.page.title = row.link;
        // Page key is the title machine readable
        if ( row && row.link ) vars.page.key = row.link.toLowerCase().replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s{1,}/g, '-');
        // Set the page's template
        vars.page.template = row.template;
        if (vars.page.key) vars.page.template += `--${vars.page.key}`;
        if (!vars.page.title) vars.page.title = 'Hello World';
        // Set other variables....
        // Set logged in user
        if ( req.user && req.user.name ) vars.user = req.user;
        // Set route
        vars.route = req.route.path;
        // Set menus
        vars.page.menus = row.menu.split(' ');
        // Set if the content is editable
        vars.editable = ( req.user && req.user.role == 'admin' );
        // Preprocess variables
        let preprocess = req.route.path.split('?')[0].replace(/^\/|\/$/gi, '').replace('-','_').replace(':','__').split('/');
        preprocess.forEach((part, index, arr)=>{
          arr[index] = part.charAt(0).toUpperCase() + part.slice(1);
        });
        preprocess = `page${preprocess.join('')}Preprocess`;
        for( let name in scope.modules )
          if ( typeof scope.modules[name][preprocess] === 'function' )
            await scope.modules[name][preprocess](vars, req);
        // add options to DOM
        vars.options = JSON.stringify(vars);
        // add menus to vars
        await scope.getMenus(req, menus=>{
          vars.menus = menus;
        });
        // Return vars
        return vars;
      }
      const routes = getRoutes(app).get;
      rows.forEach(row => {
        if ( routes.indexOf(row.path)>-1 ) return;
        if (row.callback) {
          if ( !row.middleware ) {
            return app.get(row.path, scope[row.callback]);
          }
          app.get(row.path, scope[row.middleware], scope[row.callback]);
          return;
        }
        if ( !row.middleware ) {
          return app.get(row.path, (req, res) => {
            scope.db.routes.findOne({path: req.route.path}, async (err, route) => {
              if (!route) return Niece._404(res);
              res.render(row.template, await vars(route, req));
            });
          });
        }
        app.get(row.path, scope[row.middleware], (req, res) => {
          scope.db.routes.findOne({path: req.url}, async (err, route) => {
            if (!route) return Niece._404(res);
            res.render(row.template, await vars(route, req));
          })
        });
      });
      
    });
  }
  
  setupLoginRoutes() {
    app.post('/user/login', scope.checkNotAuthenticated, passport.authenticate('local', {
      successRedirect: config.redirectionAfterLogin,
      failureRedirect: '/user/login',
      failureFlash: true
    }));
    app.post('/user/register', scope.checkNotAuthenticated, async (req, res) => {
      
      const done = async () => {
        try {
          const hashedPassword = await bcrypt.hash(req.body.password, config.passwordHashSize);
          scope.db.users.insert({
            ...Niece.userTemplate,
            id: Date.now().toString(),
            name: req.body.name,
            email: req.body.email,
            password: hashedPassword,
            verified: !config.usersRequireVerification,
            role: null,
            joined: Date.now()
          }, (err, users)=>{
            if (err) {
              req.flash('error', `A problem occured in creating a user. ${err.name}: ${err.message}`);
              return res.redirect('/');
            }
            if (!users || !users.length) {
              req.flash('error', `A problem occured in creating a user.`);
              return res.redirect('/');
            }
            const [user] = users;
            scope.db.users.update({email: user.email}, {...user, role: user._id == 2 ? 'admin' : 'regular'});
          });
          if (config.usersRequireVerification ) {
            const token = await jwt.sign({
              email: req.body.email
            }, process.env.NIECE_SECRET);
            const domain = Niece.getDomain(req);
            scope.mail(null, req.body.email, `Welcome to NIECE. Verify your account.`, `Welcome to NIECE. \n\nClick the link below to verify your account. \n\n${domain}/user/verify?token=${token} \n\nCheers, \nNIECE Admin`);
            req.flash('info', `Your account was created, and a link to verify it was sent to your email.`);
          } else {
            req.flash('info', `Your account was created!`);
          }
          res.redirect('/user/login');
        } catch (err) {
          req.flash('error', `A problem occured in creating a user. ${err}`);
          res.redirect('/user/register')
        }
      }
      
      scope.db.users.findOne({email: req.body.email}, (err, user) => {
        if ( user ) {
          req.flash('error', 'A user with that email already exists.');
          res.redirect('/user/register')
          return
        }
        done() 
      })
      
    });
    app.delete('/user/logout', (req, res) => {
      req.logOut()
      res.redirect('/user/login')
    });
    /*app.get('/user/logout', (req, res) => {
      req.logOut()
      res.redirect('/user/login')
    });*/
    app.post('/user/resend-verification', (req, res) => {
      const oops = (type, message, redirect) => {
        req.flash(type, message);
        res.redirect(redirect || '/user/resend-verification');
      }
      scope.db.users.findOne({ email: req.body.email }, async (err, user)=>{
        if ( err ) return oops('error', `${err.name}: ${err.message}`);
        if ( !user ) return oops('error', `No user found with that email.`);
        if ( !config.usersRequireVerification ) return oops('error', `Verification is not nessesary.`);
        const token = await jwt.sign({
          email: req.body.email
        }, process.env.NIECE_SECRET);
        const domain = Niece.getDomain(req);
        scope.mail(null, req.body.email, `Verify your account.`, `Click the link below to verify your account. \n\n${domain}/user/verify?token=${token} \n\nCheers, \nNIECE Admin`);
        req.flash('info', 'An email has been sent to your email to verify your account.');
        res.redirect('/user/resend-verification');
      });
    });
    app.post('/user/forgot-password', (req, res) => {
      const oops = (type, message, redirect) => {
        req.flash(type, message);
        res.redirect(redirect || '/user/forgot-password');
      }
      scope.db.users.findOne({ email: req.body.email }, async (err, user)=>{
        if ( err ) return oops('error', `${err.name}: ${err.message}`);
        if ( !user ) return oops('error', `No user found with that email.`);
        const token = await jwt.sign({
          email: req.body.email
        }, process.env.NIECE_SECRET, {
          expiresIn: config.passwordUpdateTokenExpiration
        });
        const domain = Niece.getDomain(req);
        scope.mail(null, req.body.email, 'NIECE: Password update request', `Click the link below to change your password. \n\n${domain}/user/update-password?token=${token} \n\nCheers, \n\nNIECE Admin`);
        req.flash('info', 'An email has been sent to you with a link to change your password.');
        res.redirect('/user/login');
      });
    });
    app.post('/user/update-password', (req, res) => {
      jwt.verify(req.body.token, process.env.NIECE_SECRET, async (err, authData) => {
        if(err) {
          req.flash('error', err.name == 'TokenExpiredError' ? 'The password change token has expired. '+(req.user ? 'Click "Change Password" below to try again.' : 'Request another password change link to your email, below.') : `${err.name}: An error occured. (${err.message})`);
          if ( req.user ) return res.redirect('/user/edit');
          else return res.redirect('/user/forgot-password');
        }
        if ( req.user && authData.email != req.user.email ) {
          req.flash('error', 'Incorrect token. Data doesn\'t match.');
          return res.redirect('/user/update-password');
        }
        scope.db.users.findOne({email: authData.email}, async (err, user)=>{
          const hashedPassword = await bcrypt.hash(req.body.password, config.passwordHashSize);
          const updatedUser = { ...user, password: hashedPassword };
          scope.db.users.update({email: authData.email}, updatedUser);
          scope.mail(null, authData.email, `NIECE. Your account password has changed`, `Hi, your password was updated, if this was done without your permission, please contact us at NIECE. \n\nCheers, \n\nNIECE Admin`)
          req.flash('info', 'Password updated!');
          if ( req.user ) return res.redirect('/user');
          res.redirect('/user/login');
        });
      });
    });
    app.post('/user/edit', (req, res) => {
      const updatedUser = { ...req.user, name: req.body.name, email: req.body.email };
      scope.db.users.update({email: req.user.email}, updatedUser);
      req.flash('info', 'Your account has been updated.');
      res.redirect('/user');
    });
    app.post('/users/:userID/update-role', (req, res) => {
      scope.db.users.findOne({_id: parseInt(req.params.userID) + 1}, (err, profile)=>{
        const redirectPath = `/users/${req.params.userID}`;
        if (err) {
          req.flash('error', `And error occured. ${err.name}: ${err.message}}`);
          return res.redirect(redirectPath);
        }
        if (!profile) {
          req.flash('error', `Couldn't find that user.`);
          return res.redirect(redirectPath);
        }
        const updatedUser = { ...profile, role: req.body.role };
        scope.db.users.update({email: updatedUser.email}, updatedUser, (err, usr)=>{
          req.flash('info', `Role updated to "${updatedUser.role}" for ${updatedUser.name}`);
          res.redirect(redirectPath);
        });
      });
    });
    app.get('/user/verify', (req, res) => {
      const oops = (type, message, redirect) => {
        req.flash(type, message);
        res.redirect(redirect || '/');
      }
      jwt.verify(req.query.token, process.env.NIECE_SECRET, (err, authData) => {
        if ( err ) return oops('error', `${err.name}: ${err.message}`);
        if ( !authData || (authData && !authData.email) ) return oops('error', `An issue occured in verifying your email.`);
        scope.db.users.findOne({ email: authData.email }, (err, user)=>{
          if ( err ) return oops('error', `${err.name}: ${err.message}`);
          if ( !user || (user && !authData.email) ) return oops('error', `No user found with that email.`);
          const updatedUser = { ...user, verified: true };
          scope.db.users.update({email: user.email}, updatedUser);
          req.flash('info', 'Your account has been verified.');
          res.redirect('/');
        })
      });
    });
    app.post('/content/save', this.contentSave);
    app.post('/media/upload', (req, res) => {
      let file;
      if (!req.files || Object.keys(req.files).length === 0) return res.status(400).send('No file was uploaded.');
      file = req.files.file;
      file.mv(config.publicUploadDirectory + config.publicUploadMediaDirectory + file.name, (err)=> {
        if (err) return res.status(500).send(err);
        res.json({location: config.publicUploadMediaDirectory + file.name});
      });
    })
  }
  
  static preserveHandlebars(html) {
    const markup = html.replace(/\<\!\-\-handlebars \s*([^\-]*)\-\-\>([^\<]*)\<\!\-\-\/handlebars\-\-\>/, (match, value, replacement)=>{
      replacement = `-->${replacement}<!--`;
      value = `-->${value.replace(/\s*$/, '').replace('[', '{{').replace(']', '}}')}<!--`;
      return match.replace(replacement, value);
    });
    return markup;
  }
  
  static _404(res) {
    res.status(404);
    res.render('404', scope.getSiteSettings());
  }
  
  install() {
    // Home page route
    scope.db.routes.insert({...Niece.routeTemplate, path: '/', link: 'Home',  menu: 'main footer', template: 'page'});
    // User route
    scope.db.routes.insert({...Niece.routeTemplate, path: '/users/:userID', link: null,  menu: null, template: 'profile'});
    // User authenticated routes...
    scope.db.routes.insert({...Niece.routeTemplate, path: '/user', link: 'User',  menu: 'user', template: 'user', middleware: 'checkAuthenticated'});
    scope.db.routes.insert({...Niece.routeTemplate, path: '/user/edit', link: 'Edit User',  menu: 'user', template: 'user-edit', middleware: 'checkAuthenticated'});
    scope.db.routes.insert({...Niece.routeTemplate, path: '/user/logout', link: 'Logout',  menu: 'user', callback: 'logOut', middleware: 'checkAuthenticated'});
    // User NOT authenticated routes...
    scope.db.routes.insert({...Niece.routeTemplate, path: '/user/login', link: 'Login',  menu: 'user', template: 'login', middleware: 'checkNotAuthenticated'});
    scope.db.routes.insert({...Niece.routeTemplate, path: '/user/register', link: 'Register',  menu: 'user', template: 'register', middleware: 'checkNotAuthenticated'});
    scope.db.routes.insert({...Niece.routeTemplate, path: '/user/forgot-password', link: 'Forgot Password',  menu: null, template: 'forgot-password', middleware: 'checkNotAuthenticated'});
    // Admin routes...
    scope.db.routes.insert({...Niece.routeTemplate, path: '/users', link: 'Users',  menu: 'user_admin admin', template: 'users', middleware: 'checkAdmin'});
    scope.db.routes.insert({...Niece.routeTemplate, path: '/page/new', link: 'New Page', menu: 'admin', template: 'page', middleware: 'checkAdmin'});
    // ETC routes... TODO: add middlewares
    scope.db.routes.insert({...Niece.routeTemplate, path: '/user/update-password', link: 'Update Password',  menu: null, template: 'update-password'});
    scope.db.routes.insert({...Niece.routeTemplate, path: '/user/resend-verification', link: 'Verify',  menu: null, template: 'resend-verification'});
    // Update routes from DB to express:
    scope.updateRoutes();
  }
  
  
  // Callbacks
  
  logOut(req, res) {
    req.logOut();
    res.redirect('/user/login');
  }
  
  // Middlewares
  
  checkAdmin(req, res, next) {
    res = res || {redirect:()=>{return false}};
    next = next || (()=>{return true});
    if (req.isAuthenticated() && req.user._id == 2) {
      return next();
    }
    return res.redirect('/user');
  }
  
  checkAuthenticated(req, res, next) {
    res = res || {redirect:()=>{return false}};
    next = next || (()=>{return true});
    if (req.isAuthenticated()) {
      return next();
    }
    return res.redirect('/user/login');
  }
  
  checkNotAuthenticated(req, res, next) {
    res = res || {redirect:()=>{return false}};
    next = next || (()=>{return true});
    if (req.isAuthenticated()) {
      return res.redirect('/');
    }
    return next();
  }
  
  static generatePassword(l) {
    let length = 8*(l||5),
        charset = "--------abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
        retVal = "",
        i, n;
    for (i = 0, n = charset.length; i < length; ++i)
      retVal += charset.charAt(Math.floor(Math.random() * n));
    return retVal;
  }
  
  static getDomain(req) {
    const host = req.get('host').replace(/\:(80|443)$/, '');
    return `${req.protocol}://${host}`;
  }
  
  mail(from, to, subject, message) {
    const settings = scope.getSiteSettings();
    from = from || settings.site.email;
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({sendmail: true}, {
      from: from,
      to: to,
      subject: subject,
    });
    transporter.sendMail({text: message});
  }

}

module.exports = Niece
const Neice = require('niece');
const config = {
  port: 4430,
  site: {
    title: 'My NIECE Site',
    email: 'me@me.com'
  },
  publicUploadDirectory: 'content/public',
  publicUploadMediaDirectory: '/media/',
  databaseDirectory: './db',
  usersRequireVerification: true,
  redirectionAfterLogin: '/user',
  passwordUpdateTokenExpiration: '1h',
  passwordHashSize: 10
};
new Neice( config );

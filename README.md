# NIECE
## Node.js Inline-Edited-Content & Express

### Install

Assuming that you have <a href="https://nodejs.org/en/download/package-manager/">installed node.js</a>.

Site in under a minute using terminal:

1. Build your node app: `npm init`. Note: use "index.js" for your entry point, if ya want the rest of the scripts to work.
2. Create your app file `printf '%s\n' 'const Neice = require("niece");' 'new Neice();' > index.js`
3. Install nodemon and npm-add-script to help with development: `npm install -g nodemon npm-add-script`
4. Add your dev script `npmAddScript -k dev -v "nodemon index.js"`
5. Install NIECE `npm install niece`
7. Run your app: `npm run dev` which will build the site and listen at port 4430. Your site will be http://localhost:4430/
8. Go to http://localhost:4430/user/register and create your admin account.

### Thats it!

Few notes:

 - Type control+z to end the sever
 - Run `kill -9 $(lsof -t -i:4430)` to stop listening on port 4430


<br>
<p align="center">
<a href="https://niece.box.biz/images/niece/olive.svg" />
# NIECE
</p>

#### Node.js Inline-Edited-Content & Express

### What's NIECE?
NIECE is full-stack CMS built entirely within a single npm package. It doen't really have an admin pannel as everyhitng is ediable inline. The structure is built very similarly to Drupal CMS, and does almost as much. It has a lot for it's size:
 - Bootstrap theme
 - Written entirely in Javascript (Node.js).
 - User system with roles, permissions, and email verification.
 - Media upload system.
 - Extendable using npm modules with the prefix name of "niece_"
 - and more...

You can see it in action here: http://niece.box.biz/ in fact that site is the default site the module ships with.


## Install

Assuming that you have <a href="https://nodejs.org/en/download/package-manager/">installed node.js</a>.

### Using just NPM

Site in under a minute using terminal:

1. Build your node app: `npm init`. _Note: use "index.js" for your entry point, if ya want the rest of the scripts to work._
2. Create your app file `printf '%s\n' 'const Neice = require("niece");' 'new Neice();' > index.js`
3. Install nodemon and npm-add-script to help with development: `npm install -g nodemon npm-add-script`
4. Add your dev script `npmAddScript -k dev -v "nodemon index.js"`
5. Install NIECE `npm install niece`
7. Run your app: `npm run dev` which will build the site and listen at port 4430. Your site will be http://localhost:4430/
8. Go to http://localhost:4430/user/register and create your admin account.

#### Thats it!

Few notes:
 - To restart just run `rs`
 - Type control+z to end the sever
 - Run `kill -9 $(lsof -t -i:4430)` to stop listening on port 4430

#### Install in a single script!
```
npm init -f
printf '%s\n' 'const Neice = require("niece");' 'new Neice();' > index.js
npm install -g nodemon npm-add-script
npmAddScript -k dev -v "nodemon index.js"
npm install niece
open -na "Firefox" --args --new-window "javascript:setTimeout(()=>window.location.href='http://localhost:4430', 4000)"
npm run dev
# done
```

### Using Github and NPM

Assuming you have git and node.js installed.

Git a base app `git clone https://github.com/BOXNYC/NIECE.git`
Go to it's directory `cd niece`
Install it via npm `npm install`
Run it `npm run dev`

#### Install in a single script!
```
git clone https://github.com/BOXNYC/niece.git
cd niece
npm install
npm run dev
# done
```


## Running Apache OpenSSL on your server as well? No problem!
On your httpd.conf file add a VHOST that passes the traffic to your NIECE app's port:

#### Non-Secure http:// (port 80)

```
<VirtualHost 104.130.24.68:80>
  ServerName niece.box.biz
  # Set up the proxy both ways
  SSLProxyEngine On
  ProxyPass / http://localhost:4430/
  ProxyPassReverse / http://localhost:4430/
  ProxyPreserveHost On
</VirtualHost>
```

#### Secure https:// (port 443)

```
<VirtualHost 104.130.24.68:443>
  ServerName niece.box.biz
  # Set up the proxy both ways
  SSLProxyEngine On
  ProxyPass / http://localhost:4430/
  ProxyPassReverse / http://localhost:4430/
  ProxyPreserveHost On
  # Turn on SSL
  SSLEngine on
  SSLCertificateFile /etc/ssl/2/STAR_box_biz.crt
  SSLCertificateKeyFile /etc/ssl/2/box_biz.key
  SSLCertificateChainFile /etc/ssl/2/My_CA_Bundle.ca-bundle
</VirtualHost>
```

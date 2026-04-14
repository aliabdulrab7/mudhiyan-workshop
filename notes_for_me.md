# 2. Go to the app directory
cd /var/www/mudhiyan

# 3. Pull latest code
git pull origin master

# 4. Install any new dependencies
npm install --prefix client --production=false
npm install --prefix server

# 5. Build the React frontend
npm run build --prefix client

# 6. Restart the server
pm2 restart mudhiyan

# 7. Confirm it's running
pm2 status
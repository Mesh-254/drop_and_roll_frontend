echo "Switching to Main Branch"

git checkout main

echo "Building app...."

npm run build 


echo "DEPLOYING TO SERVER......"


scp -r dist/*  wolftech@158.69.36.39:/var/www/dropnroll/



echo "DEPLOYED SUCCESSFULLY!!!"

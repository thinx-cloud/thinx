#!/bin/bash

#
# Install and check with eslint
#

# make sure this will run on CI

if [[ $(which eslint | wc -l) == 0 ]]; then
  echo "» Installing eslint..."
  npm install -g eslint
else
  echo "» eslint found, no need to install."
fi

# init should be already done and available in repo

echo "» Running esLint check..."

eslint ./**/*.js

exit 0

if [[ ! -f $(which srcclr) ]]; then
  echo "» [:] SourceClear not found, installing..."
  # curl -sSL https://srcclr.com/install | bash
  sudo apt-key adv --keyserver keyserver.ubuntu.com --recv-keys DF7DD7A50B746DD4
  sudo add-apt-repository "deb https://download.srcclr.com/ubuntu stable/"
  sudo apt-get update -y
  sudo apt-get install -y srcclr
fi

#
# [:] SourceClear
#

# should be handled by circle ci like this:
#test:
#  post:
#    - curl -sSL https://download.sourceclear.com/ci.sh | sh
# + requires added SRCCLR_API_TOKEN to Circle CI

if [[ $(which srcclr) ]]; then
  echo "Would 'srcclr scan .' but circle should do that"
  srcclr .
fi

#!/bin/bash

# This file is used for CircleCI tests (only)


USE_VAULT=false

PREFIX=$(cat ../conf/.thx_prefix)

#
# Vault
#

# Unseal Key: Khij92R4gz0ptt/emQd/SUIRlSMg2D2u20jhqNlTOOM=
# Root Token: b7fbc90b-6ae2-bbb8-ff0b-1a7e353b8641

if [[ $USE_VAULT == true ]]; then
wget https://releases.hashicorp.com/vault/0.7.0/vault_0.7.0_linux_amd64.zip
unzip vault_0.7.0*.zip
cat "export VAULT_ADDR='http://127.0.0.1:8200'" > ~/.profile
./vault policy-write "thinx" ./vault-policy.json
fi

if [[ $CIRCLECI ]]; then
echo "This should be run against the CouchDB server."
exit 0
fi

# or use ENV_VAR COUCH_USER and COUCH_PASS

if [[ -z $COUCH_USER ]]; then
echo "COUCH_USER environment variable must be set."
exit 1
fi

if [[ -z $COUCH_PASS ]]; then
echo "COUCH_PASS environment variable must be set."
exit 1
fi

if [[ -z $COUCH_URL ]]; then
echo "COUCH_URL environment variable must be set."
exit 1
fi

# May require additional authentication based on the CouchDB setup
curl -X PUT http://$COUCH_USER:$COUCH_PASS@$COUCH_URL:5984/${PREFIX}managed_devices/_design/devicelib -d @../design/design_deviceslib.json
curl -X PUT http://$COUCH_USER:$COUCH_PASS@$COUCH_URL:5984/${PREFIX}managed_users/_design/users -d @../design/design_users.json
curl -X PUT http://$COUCH_USER:$COUCH_PASS@$COUCH_URL:5984/${PREFIX}managed_logs/_design/logs -d @../design/design_logs.json
curl -X PUT http://$COUCH_USER:$COUCH_PASS@$COUCH_URL:5984/${PREFIX}managed_builds/_design/builds -d @../design/design_builds.json

curl -X PUT http://$COUCH_USER:$COUCH_PASS@$COUCH_URL:5984/${PREFIX}managed_devices/_design/repl_filters -d @../design/filters_devices.json
curl -X PUT http://$COUCH_USER:$COUCH_PASS@$COUCH_URL:5984/${PREFIX}managed_users/_design/repl_filters -d @../design/filters_users.json
curl -X PUT http://$COUCH_USER:$COUCH_PASS@$COUCH_URL:5984/${PREFIX}managed_logs/_design/repl_filters -d @../design/filters_logs.json
curl -X PUT http://$COUCH_USER:$COUCH_PASS@$COUCH_URL:5984/${PREFIX}managed_builds/_design/repl_filters -d @../design/filters_builds.json

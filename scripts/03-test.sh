#!/bin/bash

# Using API Key 'static-test-key' : 88e94c304080d95f7382751d472b39f54d687121

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color
API_KEY='adee16a3d627fc775a8a5e325cf67e57c58b38b6ab9deeef5cb4a47dcded5b7e'
OWNER_ID='4f1122fa074af4dabab76a5205474882c82de33f50ecd962d25d3628cd0603be'

DEVICE_ID=a80cc610-4faf-11e7-9a9c-41d4f7ab4083
MAC='000000000000'

function echo_fail() { # $1 = string
    COLOR=$RED
    NC='\033[0m'
    printf "${COLOR}$1${NC}\n"
}

function echo_ok() { # $1 = string
    COLOR=$GREEN
    NC='\033[0m'
    printf "${COLOR}$1${NC}\n"
}

rm -rf cookies.jar

if [[ -z $HOST ]]; then
	HOST='rtm.thinx.cloud'
fi

echo
echo "--------------------------------------------------------------------------------"
echo "» Testing authentication..."

R=$(curl -s -c cookies.jar \
-H "Origin: rtm.thinx.cloud" \
-H "User-Agent: THiNX-Web" \
-H "Content-Type: application/json" \
-d '{ "username" : "test", "password" : "tset" }' \
http://$HOST:7443/api/login)

# {"redirectURL":"https://thinx.cloud/app"}

echo $R

SUCCESS=$(echo $R | jq .redirectURL )
echo $SUCCESS
if [[ ! -z $SUCCESS ]]; then
	URL=$(echo $R | jq .redirectURL)
	echo_ok "Redirected to login: $URL"
else
	echo_fail $R
fi

R=""

echo
echo "--------------------------------------------------------------------------------"
echo "» Fetching device catalog..."

R=$(curl -s -b cookies.jar \
-H "Origin: rtm.thinx.cloud" \
-H "User-Agent: THiNX-Web" \
-H "Content-Type: application/json" \
http://$HOST:7442/api/user/devices)

# {"devices":[{"id":"...

SUCCESS=$(echo $R | jq .devices)
echo "Response: " $R
if [[ ! -z $SUCCESS ]]; then
	DEVICES=$(echo $R | jq .devices)
	echo_ok "Listed devices: $DEVICES"
else
	echo_fail $R
fi

echo
echo "--------------------------------------------------------------------------------"
echo "☢ Audit log fetch..."

# {"success":true,"logs":{"total_rows":769,"offset":0,"rows":[{"id":"ff16cba945cff2ca578b29c7024eb653","key":{"_id":"ff16cba945cff2ca578b29c7024eb653","_rev":"1-0213b9d3716d6cbc5b5c8e7d1b6deae8","message":"GET : /api/user/devices","owner":"4f1122fa074af4dabab76a5205474882c82de33f50ecd962d25d3628cd0603be","date":"2017-05-11T15:50:40.729Z"},...

R=$(curl -s -b cookies.jar \
-H "Origin: rtm.thinx.cloud" \
-H "User-Agent: THiNX-Client" \
-H "Content-Type: application/json" \
http://$HOST:7442/api/user/logs/audit)

SUCCESS=$(echo $R | jq .success)
if [[ $SUCCESS == true ]]; then
	ALOG=$(echo $R | jq .logs)
  if [[ ! -z "${ALOG}" ]]; then
	   echo_ok "Fetched audit log: $ALOG"
  else
    echo_fail $(echo $R | jq .)
  fi
else
	echo_fail $R
fi

echo
echo "--------------------------------------------------------------------------------"
echo "☢ Build log list..."

R=$(curl -s -b cookies.jar \
-H "Origin: rtm.thinx.cloud" \
-H "User-Agent: THiNX-Client" \
-H "Content-Type: application/json" \
http://$HOST:7442/api/user/logs/build/list)

SUCCESS=$(echo $R | jq .success)
BLIST=null
if [[ $SUCCESS == true ]]; then
	BLIST=$(echo $R | jq .)
	echo_ok "Fetched build log: $BLIST"
else
	echo_fail $R
fi

#exit 0

echo
echo "--------------------------------------------------------------------------------"
echo "☢ Build log fetch..."

R=$(curl -s -b cookies.jar \
-H "Origin: rtm.thinx.cloud" \
-H "User-Agent: THiNX-Client" \
-H "Content-Type: application/json" \
-d '{ "build_id" : "f168def0-597f-11e7-a932-014d5b00c004" }' \
http://$HOST:7442/api/user/logs/build)

SUCCESS=$(echo $R | jq .success)
BLOG=null
if [[ $SUCCESS == true ]]; then
	BLOG=$(echo $R | jq .)
	echo_ok "Fetched build log: $BLOG"
else
	echo_fail $R
fi

echo
echo "--------------------------------------------------------------------------------"
echo "» Pushing Env var..."

# {"success":true,"fingerprint":"d3:04:a5:05:a2:11:ff:44:4b:47:15:68:4d:2a:f8:93"}

echo "${R}"

R=$(curl -s -b cookies.jar \
-H "Authentication: ${API_KEY}" \
-H 'Origin: rtm.thinx.cloud' \
-H "User-Agent: THiNX-Web" \
-H "Content-Type: application/json" \
-d '{ "key" : "WIFI_SSID", "value" : "<enter-your-ssid-password>" }' \
http://$HOST:7442/api/user/env/add)

echo $R

SUCCESS=$(echo $R | jq .success)
FPRINT=null
if [[ $SUCCESS == true ]]; then
	FPRINT=$(echo $R | jq .object)
	echo_ok "Added ENV var: $FPRINT"
else
	echo_fail $R
fi

sleep 2

R=""

echo
echo "--------------------------------------------------------------------------------"
echo "» Listing Env vars..."

echo "${R}"

R=$(curl -s -b cookies.jar \
-H "Authentication: ${API_KEY}" \
-H 'Origin: rtm.thinx.cloud' \
-H "User-Agent: THiNX-Web" \
-H "Content-Type: application/json" \
http://$HOST:7442/api/user/env/list)

SUCCESS=$(echo $R | jq .)
if [[ ! -z $SUCCESS ]]; then
	KEYS=$(echo $R | jq .env_vars)
	echo_ok "Listed Env vars: $KEYS"
else
	echo_fail $R
fi

echo
echo "--------------------------------------------------------------------------------"
echo "» Revoking Env vars..."

# {"revoked":"d3:04:a5:05:a2:11:ff:44:4b:47:15:68:4d:2a:f8:93","success":true}

R=$(curl -s -b cookies.jar \
-H "Authentication: ${API_KEY}" \
-H 'Origin: rtm.thinx.cloud' \
-H "User-Agent: THiNX-Web" \
-H "Content-Type: application/json" \
-d '{ "names" : [ "WIFI_SSID" ] }' \
http://$HOST:7442/api/user/env/revoke)

echo "${R}"

SUCCESS=$(echo $R | jq .success)
RPRINT=null
if [[ $SUCCESS == true ]]; then
	RPRINT=$(echo $R | jq .revoked)
	echo_ok "Revoked Env var: $RPRINT"
else
	echo_fail $R
fi

sleep 2

echo
echo "--------------------------------------------------------------------------------"
echo "» Testing profile..."

R=$(curl -s -b cookies.jar \
-H "Origin: rtm.thinx.cloud" \
-H "User-Agent: THiNX-Web" \
-H "Content-Type: application/json" \
http://$HOST:7442/api/user/profile)

# {"redirectURL":"https://thinx.cloud/app"}

SUCCESS=$(echo $R | jq . )
echo $SUCCESS
if [[ ! -z $SUCCESS ]]; then
#	URL=$(echo $R | jq .)
	echo_ok "User profile response: $SUCCESS"
else
	echo_fail $R
fi

echo
echo "--------------------------------------------------------------------------------"
echo "☢ Testing firmware update (OTT-INIT)..."

R=$(curl -s \
-H "Authentication: ${API_KEY}" \
-H 'Origin: device' \
-H "User-Agent: THiNX-Client" \
-H "Content-Type: application/json" \
-d '{ "mac" : "00:00:00:00:00:00", "udid" : "'${DEVICE_ID}'", "commit" : "269c6fa21cf7e02d7db098b1fc20d14b9c8ce600", "checksum" : "30fe5d8f019d3a352deb9c1f4e7568a251fb4e8c333dbe2ea6b592f55784dd49", "owner": "'${OWNER_ID}'", "use":"ott" }' \
http://$HOST:7442/device/firmware)

echo $R

OTT=1

# {{"success":false,"status":"NOT_AVAILABLE"}

SUCCESS=$(echo $R | jq .ott)
if [[ -z $SUCCESS ]]; then
	STATUS=$(echo $R | jq .status)
	echo_fail "Firmware update result: $STATUS"
else
  OTT=$(echo $R | jq .ott)
  echo_ok "Firmware update result:\n$OTT"
	# cannot really detect fail in binary stream: echo_fail $R
fi

if [[ $OTT != "1" ]]; then
echo
echo "--------------------------------------------------------------------------------"
echo "☢ Testing firmware update (OTT-FETCH)..."

OTT=$(echo $OTT | tr -d '"')

R=$(curl -s http://$HOST:7442/device/firmware?ott=$OTT)

# {"type":"Buffer","data":"..."}

SUCCESS=$(echo $R | jq .type)
if [[ $SUCCESS == "Buffer" ]]; then
	DATA=$(echo $R | jq .data)
  if [ ! -z $DATA ]; then
	   echo_ok "Firmware update result: $DATA"
  else
    echo_fail $R
  fi
else
	echo_fail $R
fi

else
  echo "Skipping OTT Fetch, no OTT given as a result of last test."
fi


echo
echo "--------------------------------------------------------------------------------"
echo "☢ Testing device registration..."

RS='{ "registration" : { "mac" : "'${MAC}'", "firmware" : "THiNX-Test-0.4.0-beta:2017/04/08", "version" : "1.0.0", "checksum" : "e58fa9bf7f478442c9d34593f0defc78718c8732", "push" : "dhho4djVGeQ:APA91bFuuZWXDQ8vSR0YKyjWIiwIoTB1ePqcyqZFU3PIxvyZMy9htu9LGPmimfzdrliRfAdci-AtzgLCIV72xmoykk-kHcYRhAFWFOChULOGxrDi00x8GgenORhx_JVxUN_fjtsN5B7T", "alias" : "rabbit", "owner": "'${OWNER_ID}'", "platform" : "platformio", "status":"Testing", "lat":1, "lon":1 } }'

echo $RS

R=$(curl -s \
-H "Authentication: ${API_KEY}" \
-H 'Origin: device' \
-H "User-Agent: THiNX-Client" \
-H "Content-Type: application/json" \
-d "${RS}" \
http://$HOST:7442/device/register)

# {"success":false,"status":"authentication"}

echo $R

SUCCESS=$(echo $R | tr -d "\n" | jq .registration.success)
# TODO: Should return rather udid
if [[ $SUCCESS == true ]]; then
	echo_ok "Device registration result: $R"
else
	echo_fail $R
fi

echo
echo "--------------------------------------------------------------------------------"
echo "☢ Testing device registration for revocation..."

R=$(curl -s \
-H "Authentication: ${API_KEY}" \
-H 'Origin: device' \
-H "User-Agent: THiNX-Client" \
-H "Content-Type: application/json" \
-d '{ "registration" : { "mac" : "FF:FF:FF:FF:FF:FF", "firmware" : "this-is-a-test-device", "version" : 2, "hash" : "hash", "alias" : "created-by-03-test.sh", "owner": "'${OWNER_ID}'", "status":"Testing", "lat":1, "lon":1 } }' \
http://$HOST:7442/device/register)

# {"success":false,"status":"authentication"}

echo $R

SUCCESS=$(echo $R | tr -d "\n" | jq .registration.success)
if [[ $SUCCESS == true ]]; then
  DEVICE_ID=$(echo $R | tr -d "\n" | jq .registration.udid)
  echo_ok "Assigning test UDID: ${DEVICE_ID}"
	STATUS=$(echo $R | jq .status)
	echo_ok "Device registration result: $R"
else
	echo_fail $R
fi

echo
echo "--------------------------------------------------------------------------------"
echo "☢ Testing firmware update (owner test)..."


echo $R

R=$(curl -s \
-H "Authentication: ${API_KEY}" \
-H 'Origin: device' \
-H "User-Agent: THiNX-Client" \
-H "Content-Type: application/json" \
-d '{ "mac" : "FF:FF:FF:FF:FF:FF", "udid" : "'${DEVICE_ID}'", "hash" : "hash", "commit" : "e58fa9bf7f478442c9d34593f0defc78718c8732", "checksum" : "02e2436d60c629e2ab6357d0d314dd6fe28bd0331b18ca6b19a25cd6f969d0a8", "owner": "'${OWNER_ID}'" }' \
http://$HOST:7442/device/firmware)

# {"success":false,"status":"api_key_invalid"}

SUCCESS=$(echo $R | jq .success)
echo $SUCCESS
if [[ $SUCCESS == true ]]; then
	STATUS=$(echo $R | jq .status)
	echo_ok "Firmware update result: $R"
else
	echo_fail $R
fi

echo
echo "--------------------------------------------------------------------------------"
echo "☢ Statistics..."

R=$(curl -s -b cookies.jar \
-H "Origin: rtm.thinx.cloud" \
-H "User-Agent: THiNX-Client" \
-H "Content-Type: application/json" \
http://$HOST:7442/api/user/stats)

SUCCESS=$(echo $R | jq .success)
if [[ $SUCCESS == true ]]; then
	echo_ok "$R"
else
	echo_fail $R
fi

exit $?

echo
echo "--------------------------------------------------------------------------------"
echo "» Requesting new API Key..."

R=$(curl -s -b cookies.jar \
-H 'Origin: rtm.thinx.cloud' \
-H "User-Agent: THiNX-Web" \
-H "Content-Type: application/json" \
-d '{ "alias" : "test-key-name" }' \
http://$HOST:7442/api/user/apikey)

SUCCESS=$(echo $R | jq .success)
echo $SUCCESS
APIKEY=$API_KEY
if [[ $SUCCESS == true ]]; then
	A_KEY=$(echo $R | jq .api_key)
  if [[ ! -z $A_KEY ]]; then
    APIKEY=$A_KEY
  fi
  HASH=$(echo $R | jq .hash)
	echo_ok "New key to revoke: $APIKEY with hash $HASH"
else
	echo_fail $R
fi

echo
echo "--------------------------------------------------------------------------------"
echo "» Revoking API Keys..."

RK='{ "fingerprints" : ['${HASH}'] }'

R=$(curl -s -b cookies.jar \
-H 'Origin: rtm.thinx.cloud' \
-H "User-Agent: THiNX-Web" \
-H "Content-Type: application/json" \
-d "$RK" \
http://$HOST:7442/api/user/apikey/revoke)

# {"success":false,"status":"hash_not_found"}

SUCCESS=$(echo $R | jq .success)
echo $SUCCESS
#RKEY=null
if [[ $SUCCESS == true ]]; then
#	RKEY=$(echo $R | jq .)
	echo_ok "Revoked API key: $APIKEY"
else
	echo_fail $R
fi

echo
echo "--------------------------------------------------------------------------------"
echo "» Fetching API Keys..."

R=$(curl -s -b cookies.jar \
-H "Origin: rtm.thinx.cloud" \
-H "User-Agent: THiNX-Web" \
-H "Content-Type: application/json" \
http://$HOST:7442/api/user/apikey/list)

# {"api_keys":[{"name":"******************************d1343a37e4","hash":"39c1ffb0761038c3eb8fdc067132d90e5561c3ba84847a4e2f1dfb26515b2866","alias":"name"}]}

SUCCESS=$(echo $R | jq .api_keys)
echo $R
if [[ ! -z $SUCCESS ]]; then
	AKEYS=$(echo $R | jq .api_keys)
	echo_ok "Listed API keys: $AKEYS"
else
	echo_fail $R
fi

echo
echo "--------------------------------------------------------------------------------"
echo "» Fetching user sources..."

# {"success":true,"sources":[{"alias":"thinx-firmware-esp8266","url":"https://github.com/suculent/thinx-firmware-esp8266.git","branch":"origin/master"},{"alias":"thinx-firmware-esp8266","url":"https://github.com/suculent/thinx-firmware-esp8266.git","branch":"origin/master"}]}

R=$(curl -s -b cookies.jar \
-H 'Origin: rtm.thinx.cloud' \
-H "User-Agent: THiNX-Web" \
-H "Content-Type: application/json" \
http://$HOST:7442/api/user/sources/list)

SUCCESS=$(echo $R | jq .success)
SOURCES=null
if [[ $SUCCESS == true ]]; then
	SOURCES=$(echo $R | jq .sources)
	echo_ok "Listing sources: $SOURCES"
else
	echo_fail $R
fi

echo
echo "--------------------------------------------------------------------------------"
echo "» Listing RSA keys..."

# {"rsa_keys":[{"name":"name","fingerprint":"d3:04:a5:05:a2:11:ff:44:4b:47:15:68:4d:2a:f8:93"}]}

R=$(curl -s -b cookies.jar \
-H 'Origin: rtm.thinx.cloud' \
-H "User-Agent: THiNX-Web" \
-H "Content-Type: application/json" \
http://$HOST:7442/api/user/rsakey/list)

SUCCESS=$(echo $R | jq .rsa_keys)
if [[ ! -z $SUCCESS ]]; then
	KEYS=$(echo $R | jq .rsa_keys)
	echo_ok "Listed RSA keys: $KEYS"
else
	echo_fail $R
fi

echo
echo "--------------------------------------------------------------------------------"
echo "» Revoking RSA key(s)..."

# {"revoked":"d3:04:a5:05:a2:11:ff:44:4b:47:15:68:4d:2a:f8:93","success":true}

R=$(curl -s -b cookies.jar \
-H 'Origin: rtm.thinx.cloud' \
-H "User-Agent: THiNX-Web" \
-H "Content-Type: application/json" \
-d '{ "fingerprints" : [ "d3:04:a5:05:a2:11:ff:44:4b:47:15:68:4d:2a:f8:93" ] }' \
http://$HOST:7442/api/user/rsakey/revoke)

echo "${R}"

SUCCESS=$(echo $R | jq .success)
RPRINT=null
if [[ $SUCCESS == true ]]; then
	RPRINT=$(echo $R | jq .status)
	echo_ok "Revoked RSA key: $RPRINT"
else
	echo_fail $R
fi

sleep 2

echo
echo "--------------------------------------------------------------------------------"
echo "» Pushing RSA key..."

# {"success":true,"fingerprint":"d3:04:a5:05:a2:11:ff:44:4b:47:15:68:4d:2a:f8:93"}

R=$(curl -s -b cookies.jar \
-H 'Origin: rtm.thinx.cloud' \
-H "User-Agent: THiNX-Web" \
-H "Content-Type: application/json" \
-d '{ "alias" : "Initial RSA Key", "key" : "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC0PF7uThKgcEwtBga4gRdt7tiPmxzRhJgxUdUrNKj0z4rDhs09gmXyN1EBH3oATJOMwdZ7J19eP/qRFK+bbkOacP6Hh0+eCr54bySpqyNPAeQFFXWzLXJ6t/di/vH0deutYBNH6S5yVz+Df/04IjoVIf+AMDYA8ppJ3WtBm0Qp/1UjYDM3Hc93JtDwr6AUoq/k0oAroP4ikL2gyXnmVjMX0DIkBwEScXhFDi1X6u6PWvFPLeZeB5MWQUo+VnBwFctExOmEt3RWJdwv7s8uRnoaFDA2OxlQ8cMWjCx0Z/aftl8AaV/TwpFTc1Fz/LhZ54Ud3s4usHji9720aAkSXGfD test@thinx.cloud" }' \
http://$HOST:7442/api/user/rsakey/add)

SUCCESS=$(echo $R | jq .success)
FPRINT=null
if [[ $SUCCESS == true ]]; then
	FPRINT=$(echo $R | jq .fingerprint)
	echo_ok "Added RSA key: $FPRINT"
else
	echo_fail $R
fi

sleep 2

echo
echo "--------------------------------------------------------------------------------"
echo "» Listing RSA keys..."

# {"rsa_keys":[{"name":"name","fingerprint":"d3:04:a5:05:a2:11:ff:44:4b:47:15:68:4d:2a:f8:93"}]}

R=$(curl -s -b cookies.jar \
-H 'Origin: rtm.thinx.cloud' \
-H "User-Agent: THiNX-Web" \
-H "Content-Type: application/json" \
http://$HOST:7442/api/user/rsakey/list)

SUCCESS=$(echo $R | jq .rsa_keys)
if [[ ! -z $SUCCESS ]]; then
	KEYS=$(echo $R | jq .rsa_keys)
	echo_ok "Listed RSA keys: $KEYS"
else
	echo_fail $R
fi

echo
echo "--------------------------------------------------------------------------------"
echo "» Testing source add..."

# {"success":true,"source":{"alias":"thinx-firmware-esp8266","url":"https://github.com/suculent/thinx-firmware-esp8266.git","branch":"origin/master"}}

R=$(curl -b cookies.jar \
-H 'Origin: rtm.thinx.cloud' \
-H "User-Agent: THiNX-Web" \
-H "Content-Type: application/json" \
-d '{ "url" : "https://github.com/suculent/thinx-firmware-esp8266.git", "alias" : "thinx-test-repo" }' \
http://$HOST:7442/api/user/source)

echo "Response: " $R

SUCCESS=$(echo $R | jq .success)
echo $SUCCESS
SOURCE_ID=null
if [[ $SUCCESS == true ]]; then
  SOURCE_ID=$(echo $R | jq .source_id)
	echo_ok "Added source ID: $SOURCE_ID"
else
	echo_fail $R
fi

echo
echo "--------------------------------------------------------------------------------"
echo "» Testing source detach..."

# {"success":true,"attached":null}

echo "Detaching device id: $DEVICE_ID"

R=$(curl -b cookies.jar \
-H 'Origin: rtm.thinx.cloud' \
-H "User-Agent: THiNX-Web" \
-H "Content-Type: application/json" \
-d '{ "udid" : "'${DEVICE_ID}'" }' \
http://$HOST:7442/api/device/detach)

SUCCESS=$(echo $R | jq .success)
if [[ $SUCCESS == true ]]; then
	echo_ok "Detached source from device: ${DEVICE_ID}"
else
	echo_fail $R
fi

if [[ -z $SOURCE_ID ]]; then
  exit 1
fi

echo
echo "--------------------------------------------------------------------------------"
echo "» Testing source attach..."

# {"success":true,"attached":"thinx-test-repo"}

echo 'Device ID: '${DEVICE_ID}
echo 'Source ID: '${SOURCE_ID}

R=$(curl -s -b cookies.jar \
-H 'Origin: rtm.thinx.cloud' \
-H "User-Agent: THiNX-Web" \
-H "Content-Type: application/json" \
-d '{ "udid" : "'${DEVICE_ID}'", "source_id" : "'${SOURCE_ID}'" }' \
http://$HOST:7442/api/device/attach)

echo $R

SUCCESS=$(echo $R | jq .success)
ASOURCE=null
if [[ $SUCCESS == true ]]; then
	ASOURCE=$(echo $R | jq .attached)
	echo_ok "Attached source alias: $ASOURCE"
else
	echo_fail $R
fi

echo
echo "--------------------------------------------------------------------------------"
echo "☢ Testing builder..."

BC='{ "build" : { "udid" : "'${DEVICE_ID}'", "source_id" : "'${SOURCE_ID}'", "dryrun" : false } }'

echo "$BC"

R=$(curl -s -b cookies.jar \
-H "Origin: rtm.thinx.cloud" \
-H "User-Agent: THiNX-Client" \
-H "Content-Type: application/json" \
-d "$BC" \
http://$HOST:7442/api/build)

SUCCESS=$(echo $R | jq .success)
BUILD_ID=null
if [[ $SUCCESS == true ]]; then
	BUILD_ID=$(echo $R | jq .build_id)
	echo_ok "New build ID: $BUILD_ID"
else
	echo_fail $R
fi


echo
echo "--------------------------------------------------------------------------------"
echo "☢ User avatar set..."

R=$(curl -s -b cookies.jar \
-H "Origin: rtm.thinx.cloud" \
-H "User-Agent: THiNX-Client" \
-H "Content-Type: application/json" \
-d '{ "avatar" : "data:image/png;base64,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"}' \
http://$HOST:7442/api/user/profile)

SUCCESS=$(echo $R | jq .success)
if [[ $SUCCESS == true ]]; then
	echo_ok "Successfully updated avatar."
else
	echo_fail $R
fi

echo
echo "--------------------------------------------------------------------------------"
echo "☢ User info set..."

R=$(curl -s -b cookies.jar \
-H "Origin: rtm.thinx.cloud" \
-H "User-Agent: THiNX-Client" \
-H "Content-Type: application/json" \
-d '{ "info" : { "first_name" : "Bash", "last_name" : "Test", "mobile_phone" : "+420603861240", "notifications": { "all" : false, "important" : false, "info" : false }, "security" : { "unique_api_keys" : true } } }' \
http://$HOST:7442/api/user/profile)

SUCCESS=$(echo $R | jq .success)
if [[ $SUCCESS == true ]]; then
	echo_ok "Successfully updated user info."
else
	echo_fail $R
fi

echo
echo "--------------------------------------------------------------------------------"
echo "» Testing source removal..."

# {"success":true,"removed":"thinx-test-repo"}

RQ='{ "source_ids" : ['${SOURCE_ID}'] }'

echo "POST ${RQ}"

R=$(curl -s -b cookies.jar \
-H 'Origin: rtm.thinx.cloud' \
-H "User-Agent: THiNX-Web" \
-H "Content-Type: application/json" \
-d "$RQ" \
http://$HOST:7442/api/user/source/revoke)

echo $R

SUCCESS=$(echo $R | jq .success)
RSOURCE=null
if [[ $SUCCESS == true ]]; then
	RSOURCE=$(echo $R | jq .)
	echo_ok "Removed source alias: $RSOURCE"
else
	echo_fail "$R"
fi

echo
echo "--------------------------------------------------------------------------------"
echo "» Fetching device catalog..."

R=$(curl -s -b cookies.jar \
-H "Origin: rtm.thinx.cloud" \
-H "User-Agent: THiNX-Web" \
-H "Content-Type: application/json" \
http://$HOST:7442/api/user/devices)

# {"devices":[{"id":"...

SUCCESS=$(echo $R | jq .devices)
# echo $SUCCESS
if [[ ! -z $SUCCESS ]]; then
	DEVICES=$(echo $R | jq .devices)
	echo_ok "Listed devices: $DEVICES"
else
	echo_fail $R
fi



# next seems to break it...

echo
echo "--------------------------------------------------------------------------------"
echo "☢ Assigning device alias..."

CH='{ "changes" : { "udid" : '${DEVICE_ID}', "alias" : "new-test-alias" } }'

echo "POST ${CH}"

R=$(curl -s -b cookies.jar \
-H "Authentication: ${API_KEY}" \
-H 'Origin: device' \
-H "User-Agent: THiNX-Client" \
-H "Content-Type: application/json" \
-d "$CH" \
http://$HOST:7442/api/device/edit)

# {"success":true,"status":"updated"}

echo $R

SUCCESS=$(echo $R | tr -d "\n" | jq .success)
if [[ $SUCCESS == true ]]; then
	echo_ok "Alias assignment result: $R"
else
	echo_fail $R
fi


echo
echo "--------------------------------------------------------------------------------"
echo "☢ Testing device revocation..."

DR='{ "udid" : "'${DEVICE_ID}'" }'

echo $DR

R=$(curl -s -b cookies.jar \
-H "Authentication: ${API_KEY}" \
-H 'Origin: device' \
-H "User-Agent: THiNX-Client" \
-H "Content-Type: application/json" \
-d "$DR" \
http://$HOST:7442/api/device/revoke)

# {"success":false,"status":"authentication"}

echo $R

SUCCESS=$(echo $R | tr -d "\n" | jq .success)
if [[ $SUCCESS == true ]]; then
	STATUS=$(echo $R | jq .status)
	echo_ok "Device revocation result: $R"
else
	echo_fail $R
fi

sleep 2

echo
echo "--------------------------------------------------------------------------------"
echo "☢ Testing device revocation..."

DR='{ "udid" : '${DEVICE_ID}' }'

echo $DR

R=$(curl -s -b cookies.jar \
-H "Authentication: ${API_KEY}" \
-H 'Origin: device' \
-H "User-Agent: THiNX-Client" \
-H "Content-Type: application/json" \
-d "$DR" \
http://$HOST:7442/api/device/revoke)

# {"success":false,"status":"authentication"}

SUCCESS=$(echo $R | tr -d "\n" | jq .success)
if [[ $SUCCESS == false ]]; then
	STATUS=$(echo $R | jq .status)
	echo_ok "Device revocation result: $R"
else
	echo_fail $R
fi

#exit 0

#echo
#echo "☢ Running nyc code coverage..."
#
#HOST="thinx.cloud"
#HOST="localhost"
#
#nyc --reporter=lcov --reporter=text-lcov npm test

#echo
#echo "☢ Running Karma..."

# karma start


if [ ! -z $CIRCLE ]; then

	#killall node
	pm2 stop index
	exit 0

	echo
	echo "» Terminating node.js..."

	DAEMON="node thinx.js"
	NODEZ=$(ps -ax | grep "$DAEMON")

	if [[ $(echo $NODEZ | wc -l) > 1 ]]; then

		echo "${NODEZ}" | while IFS="pts" read A B ; do
			NODE=$($A | tr -d ' ')
			echo "Killing: " $NODE $B
			kill "$NODE"
		done

	else
		echo "${NODEZ}"
	fi
fi

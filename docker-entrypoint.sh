#! /bin/sh
set -e

conf_file=${CONFIG_DIR}+"/config.json"
if [ -f "$conf_file" ]; then
	echo "ez mugitu"
	rm /config.json.example
else
	cp -u /config.json.example ${CONFIG_DIR}/config.json
fi

sed -i 's~CONFIG_DIR~'${CONFIG_DIR}'~' /usr/src/app/index.js

exec node index.js
/** This THiNX-RTM API module is responsible for managing builds and should be offloadable to another server. */

var Builder = (function() {

	console.log("builder.js: loding globals...");
	var Globals = require("./globals.js");
	console.log("builder.js: fetching app_config...");
  var app_config = Globals.app_config();
	console.log("builder.js: fetching prefix...");
  var prefix = Globals.prefix();
	console.log("builder.js: prefix: "+prefix);
  // var rollbar = Globals.rollbar();

	var db = app_config.database_uri;
	var ROOT = app_config.project_root;

	const uuidV1 = require("uuid/v1");
	const mkdirp = require("mkdirp");
	const exec = require("child_process");
	const fs = require("fs");
	const path = require("path");
	const finder = require("fs-finder");
	const sha256 = require("sha256");
	const YAML = require('yaml');

	console.log("builder.js: connecting device DB...");

	var devicelib = require("nano")(db).use(prefix + "managed_devices");

	console.log("builder.js: connecting user DB...");

	var userlib = require("nano")(db).use(prefix + "managed_users");

	console.log("builder.js: Loading apienv...");

	var apienv = require("./apienv");

	console.log("builder.js: Loading buildlog...");

	var blog = require("./buildlog");

	console.log("builder.js: Loading repository...");

	var repository = require("./repository");

	console.log("builder.js: Loading apikey...");

	var apikey = require("./apikey");

	console.log("builder.js: Loading version...");

	var v = require("./version");

	console.log("builder.js: Loading build template...");

	var thinx_json_template = require("../../builder.thinx.dist.json");

	if (!fs.existsSync('../../builder.thinx.json')) {
		console.log("Please adjust builder.thinx.dist.json before running a build.");
	}

	console.log("builder.js: Initialized...");

	// private
	var _private = {

		notify: function(udid, notifiers, message, success) {

			// Success string has various visual forms in UI
			var successString;
			if (success) {
				successString = "success"; // green
			} else {
				successString = "failed"; // orange
			}
			if (message.indexOf("build_running") !== -1) {
				successString = "info"; // blue
			}

			var notification = {
				notification: {
					title: "Build Status",
					body: message.toString(),
					type: successString,
					udid: udid
				}
			};

			const websocket = notifiers.websocket;
			if (typeof(websocket) !== "undefined" && websocket !== null) {
				try {
					if (websocket.isAlive) {
						websocket.send(JSON.stringify(notification), function ack(error) {
						  if (typeof(error) !== "undefined") {
								console.log("builder websocket error: "+error);
							}
						});
					} else {
						console.log("Skipping dead websocket notification.");
					}
				} catch (e) {
					console.log("[builder] ws_send_exception" + e);
				}
			} else {
				console.log("[notify] No websocket."); // debug only
			}

		},

		buildCommand: function(build_id, owner, git, branch, udid, dryrun, notifiers, callback) {

			// Guards (early exit on invalid parameters)

			if (typeof(owner) === "undefined") {
				console.log("owner is undefined, exiting!");
				if (typeof(callback) !== "undefined") {
					callback(false, "owner undefined");
				}
				return false;
			}

			if (typeof(git) === "undefined") {
				console.log("git is undefined, exiting!");
				if ((typeof(callback) !== "undefined") && (callback !== null)) {
					callback(false, "git undefined");
				}
				return false;
			}

			if (typeof(branch) === "undefined") {
				console.log("branch is undefined, exiting!");
				if ((typeof(callback) !== "undefined") && (callback !== null)) {
					callback(false, "branch undefined");
				}
				return false;
			}

			// Log build start

			blog.log(build_id, owner, udid, "Build started..."); // may take time to save

			console.log("[builder] [BUILD_STARTED] Executing build chain...");
			console.log("[builder] Fetching device " + udid + " for owner " + owner);

			// Fetch device info

			devicelib.get(udid, function(err, device) {

				if (err) {
					callback(false, "no_such_udid");
					return;
				}

				// From `builder`

				// unused, delete if not needed: var OWNER_ID_HOME = app_config.data_root + app_config.deploy_root + "/data/" + owner;
				var BUILD_PATH = app_config.data_root + app_config.build_root + "/" + owner + "/" + udid + "/" + build_id;
				// var LOG_PATH = BUILD_PATH + "/build.log";

				//
				// Embed Authentication
				//

				console.log("[builder] Fetching API Keys for owner "+owner);

				apikey.list(owner, function(success, json_keys) {

					if (!success) {
						console.log("API Key list failed. " + json_keys);
						if (typeof(callback) !== "undefined") {
							callback(false, "owner_has_no_api_keys"); // using first API key by default until we'll have initial API key based on user creation.
						}
						_private.notify(udid, notifiers, "error_api_key_list_failed", false);
						blog.state(build_id, owner, udid, "failed");
						return;
					}

					var last_key_hash = null;
					var api_key = null;

					// deprecated
					if (typeof(device.keyhash) !== "undefined") {
						last_key_hash = device.keyhash;
					}

					if (typeof(device.lastkey) !== "undefined") {
						last_key_hash = device.lastkey;
					}

					for (var key in json_keys) {
						var kdata = json_keys[key];
						// console.log("kdata: " + JSON.stringify(kdata));
						if ((typeof(kdata) !== "undefined") && (kdata !== null)) {
							if (sha256(kdata.hash) == last_key_hash) {
								api_key = kdata.name;
								break;
							} else {
								api_key = kdata.name; // pick valid key automatically if not the selected one
							}
						}
					}

					if (api_key === null) {
						callback(false, "build_requires_api_key");
						blog.state(build_id, owner, udid, "failed-no_api_key");
						return;
					}

					//
					// Create deployment path
					//

					mkdirp(BUILD_PATH, function(err) {

						if (err) {
							console.log("[builder] " + err);
							_private.notify(udid, notifiers, "error_io_failed", false);
							blog.state(build_id, owner, udid, "failed");
							callback(false, err);
							return;

						} else {

							_private.notify(udid, notifiers, "fetching_git", true);

							const state = {
								build_id: build_id,
								owner: owner,
								udid: udid,
								state: "started"
							};

							console.log("Loggin state: "+JSON.stringify(state, false, 2));

							blog.state(build_id, owner, udid, "started");

							console.log("[builder] Build path:" + BUILD_PATH + " created.");

							//
							// Fetch GIT repository
							//

							// Attempt for at least some sanitation of the user input to prevent shell and JSON injection
							var sanitized_branch = branch.replace("origin/", "");
									sanitized_branch = sanitized_branch.replace(/{/g, "");
									sanitized_branch = sanitized_branch.replace(/}/g, "");
									sanitized_branch = sanitized_branch.replace(/\\/g, "");
									sanitized_branch = sanitized_branch.replace(/"/g, "");
									sanitized_branch = sanitized_branch.replace(/'/g, "");
									sanitized_branch = sanitized_branch.replace(/;/g, "");
									sanitized_branch = sanitized_branch.replace(/&/g, "");

							var sanitized_url = git.replace(/'/g, "");
									sanitized_url = sanitized_url.replace(/{/g, "");
									sanitized_url = sanitized_url.replace(/}/g, "");
									sanitized_url = sanitized_url.replace(/\\/g, "");
									sanitized_url = sanitized_url.replace(/"/g, "");
									sanitized_url = sanitized_url.replace(/;/g, "");
									sanitized_url = sanitized_url.replace(/&/g, "");

							console.log("[builder] Pre-fetching " + git + " to " + BUILD_PATH + "...");

							var SHELL_FETCH = "cd " + BUILD_PATH + "; if $(git clone " + sanitized_url +
								" -b " + sanitized_branch + "); then cd *; git pull origin " + sanitized_branch + " --recurse-submodules; fi";

							try {
								console.log("Running command "+SHELL_FETCH);
								result = exec.execSync(SHELL_FETCH).toString().replace("\n", "");
							} catch (e) {
								console.log("[builder] git_fetch_exception " + e);
								console.log("GIT fetch error: " + result);
								// do not exit, will try again with private keys...
							}

							// try to solve access rights issue by using owner keys...
							var git_success = fs.existsSync(BUILD_PATH + "/*");

							console.log("Initial prefetch successful? : " + git_success);
							if ( git_success == false || git_success == [] ) {

								console.log("Searching for SSH keys...");

								// only private owner keys
								var key_paths = fs.readdirSync(app_config.ssh_keys).filter(
									file => ((file.indexOf(owner) !== -1) && (file.indexOf(".pub") === -1))
								);

								console.log({ key_paths });

								if (key_paths.count < 1) {
									callback(false, "no_rsa_key_found");
									blog.state(build_id, owner, udid, "no_rsa_key_found");
									return;
								}

								console.log("No problem for builder, re-try using SSH keys...");

								// TODO: FIXME: same pattern is in device.attach() and sources.add()
								for (var kindex in key_paths) {
									// TODO: skip non-owner keys
									//var prefix = "ssh-agent bash -c 'ssh-add " + app_config.ssh_keys + "/" + key_paths[kindex] + "; ".replace("//", "/");
									var prefix = "cp " + app_config.ssh_keys + "/" + key_paths[kindex] + " ~/.ssh/id_rsa; "; // needs cleanup after build to prevent stealing code!
									   prefix += "cp " + app_config.ssh_keys + "/" + key_paths[kindex] + ".pub ~/.ssh/id_rsa.pub; bash -c '";

									try {
										var GIT_FETCH = prefix + SHELL_FETCH + "'";
										console.log("GIT_FETCH: " + GIT_FETCH);
										result = exec.execSync(GIT_FETCH).toString().replace("\n", "");
										console.log("[builder] git rsa clone result: " + result);
										break;
									} catch (e) {
										console.log("git rsa clone error (cleaning up...): "+e);
										var RSA_CLEAN = "rm -rf ~/.ssh/id_rsa && rm -rf ~/.ssh/id_rsa.pub";
										exec.execSync(RSA_CLEAN);
										callback(false, "git_fetch_failed_private");
										blog.state(build_id, owner, udid, "git_fetch_failed_private");
										return;
									}
								}
							} else {
								console.log("GIT Fetch Result: " + result);
							}

							var files = fs.readdirSync(BUILD_PATH);
							console.log("Fetched project Files: " + JSON.stringify(files));

							var directories = fs.readdirSync(BUILD_PATH).filter(
								file => fs.lstatSync(path.join(BUILD_PATH, file)).isDirectory()
							);
							console.log("Fetched project Directories: " + JSON.stringify(directories));

							if ((files.length == 0) && (directories.length == 0)) {
								callback(false, "git_fetch_failed_private");
								blog.state(build_id, owner, udid, "git_fetch_failed_private");
								return;
							}

							// Adjust XBUILD_PATH (build path incl. inferred project folder, should be one.)
							var XBUILD_PATH = BUILD_PATH;

							if (directories.length > 1) {
								XBUILD_PATH = BUILD_PATH + "/" + directories[1]; // 1 is always git
								console.log("ERROR, TOO MANY DIRECTORIES!");
							}

							if (directories.length == 1) {
								XBUILD_PATH = BUILD_PATH + "/" + directories[0];
							}

							console.log("XBUILD_PATH: " + XBUILD_PATH);

							repository.getPlatform(XBUILD_PATH, function(success, platform) {

								if (!success) {
									console.log("[builder] failed on unknown platform" +
										platform);
									_private.notify(udid, notifiers, "error_platform_unknown", false);
									blog.state(build_id, owner, udid, "failed");
									callback(false, "unknown platform: " + platform);
									return;
								}

								// feature/fix ->
								//
								// Verify firmware vs. device MCU compatibility (based on thinx.yml compiler definitions)
								//

								var platform = device.platform;
								var platform_array = platform.split(":");
								var device_platform = platform_array[0]; // should work even without delimiter
								var device_mcu = platform_array[1];

								const yml_path = XBUILD_PATH + "/thinx.yml";
								const isYAML = fs.existsSync(yml_path);

								var y_platform = device_platform;

								if (isYAML) {
									const y_file = fs.readFileSync(yml_path, 'utf8');
									const yml = YAML.parse(y_file);

									if (typeof(yml) !== "undefined") {
										console.log("Parsed YAML: "+JSON.stringify(yml));
										// This takes first key. It could be possible to have more keys (array allows same names)
										// and find the one with closest platform.
										y_platform = Object.keys(yml)[0];
										console.log("[builder] YAML-based platform: " + y_platform);
										const y_mcu = yml[y_platform].arch;
										if (y_mcu.indexOf(device_mcu) == -1) {
											const message = "MCU defined by thinx.yml (" + y_mcu + ") not compatible with this device MCU: " + device_mcu;
											console.log(message);
											blog.state(build_id, owner, udid, message);
											callback(false, message);
											return;
										} else {
											console.log("MCU is compatible.");
										}

										/* Store platform + architecture if possible (o'rly?... we need y_platform later. REFACTOR)
										if ( (typeof(yml.arduino) !== "undefined") &&
												 (typeof(yml.arduino.arch) !== "undefined") ) {
													 device_platform = y_platform + ":" + yml.arduino.arch;
										}*/
									}
								} else {
									console.log("BuildCommand-Detected platform (no YAML at " + yml_path + "): " + platform);
								}

								// <- platform_descriptor needs header (maybe only, that's OK)

								var d_filename = app_config.project_root + "/platforms/" +
									y_platform + "/descriptor.json";

								if (!fs.existsSync(d_filename)) {
									console.log("no descriptor found at "+d_filename);
									blog.state(build_id, owner, udid, "builder not found");
									callback(false, "builder not found for platform in: " + d_filename);
									return;
								}

								var platform_descriptor = require(d_filename);
								var commit_id = exec.execSync("cd " + XBUILD_PATH +
									"; git rev-list --all --max-count=1").toString();
								var rev_command = "git rev-list --all --count";
								var git_revision = exec.execSync("cd " + XBUILD_PATH + "; " +
									rev_command).toString();

								console.log("[builder] Trying to fetch GIT tag...");

								// --> Safe version of the pattern, should be extracted as fn.
								var git_tag = null;
								var tag_command = "git describe --abbrev=0 --tags";
								try {
									git_tag = exec.execSync("cd " + XBUILD_PATH + "; " +
										tag_command).toString();
								} catch (e) {
									console.log(
										"[builder] TODO: HIDE THIS: Exception while getting git tag: " +
										e
									);
									git_tag = "1.0";
								}
								if (git_tag === null) {
									git_tag = "1.0";
								}
								// <--

								var REPO_VERSION = (git_tag + "." + git_revision).replace(/\n/g, "");
								var HEADER_FILE_NAME = platform_descriptor.header;

								console.log("[builder] REPO_VERSION (TAG+REV) [unused var]: '" + REPO_VERSION.replace(/\n/g, "") + "'");

								var header_file = null;
								try {
									console.log("Finding " + HEADER_FILE_NAME + " in " +
										XBUILD_PATH);
									var h_file = finder.from(XBUILD_PATH).findFiles(
										HEADER_FILE_NAME);
									if ((typeof(h_file) !== "undefined") && h_file !== null) {
										header_file = h_file[0];
									}
									console.log("[builder] found header_file: " + header_file);
								} catch (e) {
									console.log(
										"TODO: FAIL HERE: Exception while getting header file, use FINDER instead!: " +
										e);
										blog.state(build_id, owner, udid, "thinx.h not found");
								}

								if (header_file === null) {
									header_file = XBUILD_PATH / HEADER_FILE_NAME;
									console.log("header_file empty, assigning path: " +
										header_file);
								}

								console.log("[builder] Final header_file: " + header_file);

								var REPO_NAME = XBUILD_PATH.replace(/^.*[\\\/]/, '').replace(".git", "");

								//
								// Fetch API Envs and create header file
								//

								apienv.list(owner, function(success, api_envs) {

									if (!success) {
										console.log("[builder] [APIEnv] Listing failed:" +
											owner);
										callback(false, "APIEnv list failed.");
										blog.state(build_id, owner, udid, "APIEnv list failed");
										return;
									}

									// --> extract from here
									var thinx_json = thinx_json_template;

									for (var api_env in api_envs) {
										thinx_json[api_env] = api_envs[api_env];
									}

									// Attach/replace with important data
									thinx_json.THINX_ALIAS = device.alias;
									thinx_json.THINX_OWNER = device.owner;
									thinx_json.THINX_API_KEY = api_key; // inferred from last_key_hash
									thinx_json.THINX_COMMIT_ID = commit_id.replace.replace(/\n/g, "");
									thinx_json.THINX_FIRMWARE_VERSION_SHORT = git_tag.replace.replace(/\n/g, "");
									thinx_json.THINX_FIRMWARE_VERSION = REPO_NAME + ":" + git_tag.replace.replace(/\n/g, "");
									thinx_json.THINX_UDID = udid;
									thinx_json.THINX_APP_VERSION = v.revision();

									thinx_json.THINX_CLOUD_URL = app_config.base_url;
									thinx_json.THINX_MQTT_URL = app_config.mqtt.server.replace("mqtt://", ""); // due to problem with slashes in json and some libs on platforms
									thinx_json.THINX_AUTO_UPDATE = true; // device.autoUptate
									thinx_json.THINX_MQTT_PORT = app_config.mqtt.port;
									thinx_json.THINX_API_PORT = app_config.port;
									//thinx_json.THINX_API_PORT = app_config.secure_port; // we wish
									thinx_json.THINX_PROXY = "thinx.local";
									thinx_json.THINX_PLATFORM = platform;
									thinx_json.THINX_AUTO_UPDATE = device.auto_update;
									// <-- extract to here

									fs.writeFile(XBUILD_PATH + "/thinx_build.json", JSON.stringify(
										thinx_json), function(err) {
										if (err) {
											_private.notify(udid, notifiers, "error_configuring_build", false);
											blog.state(build_id, owner, udid, "failed");
											return console.log("[builder] " + err);
										}

										console.log(
											"[builder] Calling pre-builder to generate headers from thinx_build.json..."
										);
										console.log(JSON.stringify(require(XBUILD_PATH + "/thinx_build.json"), null, 4));

										if (XBUILD_PATH.indexOf("undefined") !== -1) {
											return console.log("XBUILD_PATH_ERROR:" +
												XBUILD_PATH);
										}

										var PRE = "cd " + ROOT + "; " + ROOT +
											"/pre-builder --json=" + XBUILD_PATH +
											"/thinx_build.json --workdir=" + XBUILD_PATH +
											" --root=" + ROOT;

										console.log("Pre-building with command: " + PRE);

										try {
											var presult = exec.execSync(PRE);
											console.log("[builder] Pre-build: " +
												presult.toString());
										} catch (e) {
											callback(false, {
												success: false,
												status: "pre_build_failed"+e
											});
											return;
										}

										console.log("[builder] Start build env...");

										var CMD = "cd " + ROOT + ";" + ROOT +
											"/builder --owner=" + owner +
											" --udid=" + udid +
											" --git=" +
											git + " --id=" + build_id + " --workdir=" +
											XBUILD_PATH;

										if (dryrun === true) {
											CMD = CMD + " --dry-run";
										}

										if (udid === null) {
											console.log("[builder] Cannot build without udid!");
											_private.notify(udid, notifiers, "error_starting_build", false);
											blog.state(build_id, owner, udid, "failed");
											return;
										}

										apienv.list(owner, function(success, keys) {

											if (!success) {
												console.log(
													"[builder] Custom Environment Variables not loaded."
												);
											} else {
												var stringVars = JSON.stringify(keys);
												console.log(
													"[builder] Build with Custom Environment Variables: " +
													stringVars);
												CMD = CMD + " --env=" + stringVars;
											}

											console.log("[builder] Building in shell: " + CMD);

											_private.notify(udid, notifiers, "build_running", true);

											var shell = exec.spawn(CMD, {
												shell: true
											});

											console.log("[OID:" + owner +
												"] [BUILD_STARTED] Running normal-exec... from " +
												__dirname);

											shell.stdout.on("data", function(data) {
												var string = data.toString();
												var logline = string;
												if (logline.substr(logline.count - 3, 1) === "\n\n") {
													logline = string.substr(0, string.count - 2); // cut trailing newline
												}
												if (logline !== "\n") {
													console.log("[builder] [STDOUT] " + logline);
												}
											});

											shell.stderr.on("data", function(data) {
												var dstring = data.toString();
												console.log("[STDERR] " + data);
												if (dstring.indexOf("fatal:") !== -1) {
													blog.state(build_id, owner, udid, "failed");
												}

											});

											shell.on("exit", function(code) {
												console.log("[OID:" + owner +
													"] [BUILD_COMPLETED] [builder] with code " +
													code
												);
												if (code > 0) {

													_private.notify(udid, notifiers, "build_failed", false);
													blog.state(build_id, owner, udid, "failed");

													/*
													notifiers.messenger.slack(
														owner,
														"Build failed",
														function(err, response) {});
														*/

													// --> extract from here with notification
													const websocket = notifiers.websocket;
													if (typeof(websocket) !== "undefined" && websocket !== null) {
														try {
															websocket.send(JSON.stringify({
																notification: "Build failed."
															}));
														} catch (e) {
															console.log(e);
														}
													}

												} else {

													_private.notify(udid, notifiers, "build_completed", true);
													blog.state(build_id, owner, udid, "success");

													/*
													notifiers.messenger.slack(
														owner,
														"Build successful",
														function(err, response) {});
														*/

													// --> extract from here with notification
													const websocket = notifiers.websocket;
													if (typeof(websocket) !== "undefined" && websocket !== null) {
														try {
															websocket.send(JSON.stringify({
																notification: "Build successful."
															}));
														} catch (e) {
															console.log(e);
														}
													}
													// <-- extract to here
												}
											});
										});
									});
								});
							});
						}
					});
				});
			});
		}
	};

	// public
	var _public = {

		build: function(owner, build, notifiers, callback) {

			var build_id = uuidV1();
			var udid;

			if (typeof(callback) === "undefined") {
				callback = function() {};
			}

			var dryrun = false;
			if (typeof(build.dryrun) !== "undefined") {
				dryrun = build.dryrun;
			}

			if (typeof(build.udid) !== "undefined") {
				if (build.udid === null) {
					callback(false, {
						success: false,
						status: "missing_device_udid"
					});
					return;
				}
				udid = build.udid;
			} else {
				console.log("NOT Assigning empty build.udid! " + build.udid);
			}

			if (typeof(build.source_id) === "undefined") {
				callback(false, {
					success: false,
					status: "missing_source_id"
				});
				return;
			}

			if (typeof(owner) === "undefined") {
				callback(false, {
					success: false,
					status: "missing_owner"
				});
				return;
			}

			devicelib.view("devicelib", "devices_by_owner", {
				"key": owner,
				"include_docs": true
			}, function(err, body) {

				if (err) {
					if (err.toString() == "Error: missing") {
						callback(false, {
							success: false,
							status: "no_devices"
						});
					}
					console.log("[builder] /api/build: Error: " + err.toString());
					return;
				}

				var rows = body.rows; // devices returned
				var device = null;

				for (var row in rows) {
					//if (!rows.hasOwnProperty(row)) continue;
					//if (!rows[row].hasOwnProperty("doc")) continue;
					device = rows[row].doc;
					if (!device.hasOwnProperty("udid")) continue;
					var db_udid = device.udid;

					var device_owner = "";
					if (typeof(device.owner) !== "undefined") {
						device_owner = device.owner;
					} else {
						device_owner = owner;
					}

					if (device_owner.indexOf(owner) !== -1) {
						if (udid.indexOf(db_udid) != -1) {
							udid = device.udid; // target device ID
							break;
						}
					}
				}

				if ((typeof(device) === "undefined") || device === null) {
					console.log("Device not found for this source/build.");
					callback(false, "device_not_found");
					return;
				}

				console.log("Building for device: " + JSON.stringify(device));

				// Converts build.git to git url by seeking in users' repos
				userlib.get(owner, function(err, doc) {

					if (err) {
						console.log("[builder] " + err);
						callback(false, {
							success: false,
							status: "device_fetch_error"
						});
						return;
					}

					if ((typeof(doc) === "undefined") || doc === null) {
						callback(false, "no_such_owner", build_id);
						return;
					}

					var git = null;

					// Finds first source with given source_id
					var sources = Object.keys(doc.repos);

					console.log("[builder] searching: " + JSON.stringify(doc.repos) + " in: " + JSON.stringify(
						sources));

					for (var index in sources) {
						//if (typeof(doc.repos) === "undefined") continue;
						//if (!sources.hasOwnProperty(index)) continue;
						//if (!doc.repos.hasOwnProperty(sources[index])) continue;
						var source = doc.repos[sources[index]];
						var source_id = sources[index];
						if (typeof(source_id) === "undefined") {
							console.log("[builder] source_id at index " + index + "is undefined, skipping...");
							continue;
						}
						if (source_id.indexOf(build.source_id) !== -1) {
							git = source.url;
							branch = source.branch;
							console.log("[builder] git found: " + git);
							break;
						}
					}

					if ((typeof(udid) === "undefined" || build === null) ||
						(typeof(owner) === "undefined" || owner === null || owner === "") ||
						(typeof(git) === "undefined" || git === null || git === "")) {
						callback(false, {
							success: false,
							status: "invalid_params"
						});
						return;
					}

					console.log("[builder]??build_id: " + build_id);
					console.log("[builder]??udid: " + udid);
					console.log(
						"[builder]??owner: " +
						owner);
					console.log("[builder]??git: " + git);

					// Tag device asynchronously with last build ID
					//devicelib.destroy(device._id, device._rev, function(err) {

					/*
					if (err) {
						console.log("[builder] DATABASE CORRUPTION ISSUE!");
						console.log(err);
						return;
					}*/

					device.build_id = build_id;
					delete device._rev;
					delete device._id;

					console.log("Build atomically updating device with " + JSON.stringify(device));

					devicelib.atomic("devicelib", "modify", device.udid, device, function(error, body) {
						if (error) {
							console.log(error);
							devicelib.insert(device, device.udid,
								function(err, body,
									header) {
									if (err) {
										console.log("[builder] " + err, body);
									}
								});
						}
					});

					if (dryrun === false) {
						callback(true, {
							success: true,
							status: "BUILDING",
							build_id: build_id
						});
					} else {
						callback(true, {
							success: true,
							status: "DRY-RUN",
							build_id: build_id
						});
					}

					_private.buildCommand(build_id, owner, git, branch, udid, dryrun, notifiers, callback);

				});
			});
		},

		supportedLanguages: function() {
			var languages_path = app_config.project_root + "/languages";
			var languages = fs.readdirSync(languages_path).filter(
				file => fs.lstatSync(path.join(languages_path, file)).isDirectory()
			);
			//console.log("Supported languages: " + JSON.stringify(languages));
			return languages;
		},

		supportedExtensions: function() {
			var languages_path = app_config.project_root + "/languages";
			var languages = _public.supportedLanguages();
			var extensions = [];
			for (var lindex in languages) {
				var dpath = languages_path + "/" + languages[lindex] +
					"/descriptor.json";
				var descriptor = require(dpath);
				if (typeof(descriptor) !== "undefined") {
					var xts = descriptor.extensions;
					for (var eindex in xts) {
						extensions.push(xts[eindex]);
					}
				} else {
					console.log("No Language descriptor found at " + dpath);
				}
			}
			return extensions;
		}

	};

	return _public;

})();

exports.build = Builder.build;
exports.supportedLanguages = Builder.supportedLanguages;
exports.supportedExtensions = Builder.supportedExtensions;

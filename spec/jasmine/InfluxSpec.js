const expect = require('chai').expect;
const Influx = require('../../lib/thinx/influx');

describe("InfluxDB", function() {

    /*

    static get_owner_template() {
		// Defines data model and also lists known tracked keys
		return {
			APIKEY_INVALID: [0],
			LOGIN_INVALID: [0],
			APIKEY_MISUSE: [0],
			APIKEY_REVOKED: [0],
			DEVICE_NEW: [0],
			DEVICE_CHECKIN: [0],
			DEVICE_UPDATE_OK: [0], // TODO (22): not implemented
			DEVICE_UPDATE_FAIL: [0], // TODO (22): not implemented
			DEVICE_REVOCATION: [0],
			BUILD_STARTED: [0],
			BUILD_SUCCESS: [0],
			BUILD_FAIL: [0]
		};
	}

    */
  
    it("should write with owner_id without udid", function() {
        let data = {
            owner_id: "test",
            event: "LOGIN_INVALID",
            value: 1.0
        }
        expect(Influx.write(data)).to.equal(true);
    });
  
    it("should write with owner_id and udid", function() {
        let data = {
            owner_id: "test",
            udid: "test",
            event: "checkin",
            value: 1.0
        }
        expect(Influx.write(data)).to.equal(true);
      });
  });
  
var APIKey = require("../../lib/thinx/apikey");
var expect = require('chai').expect;
var sha256 = require("sha256");
var envi = require("../_envi.json");
var owner = envi.oid;

let Globals = require('../../lib/thinx/globals');
const redis_client = require('redis');

describe("API Key", function () {

  let apikey;

  beforeAll(async () => {
    console.log(`🚸 [chai] >>> running API Key spec`);
    // Initialize Redis
    redis = redis_client.createClient(Globals.redis_options());
    await redis.connect();
    apikey = new APIKey(redis);
  });

  afterAll(() => {
    console.log(`🚸 [chai] <<< completed API Key spec`);
  });

  //list: function(invalid-owner, callback)
  it("(00) should be able to list empty API Keys", function (done) {
    apikey.list(
      "dummy",
      (object) => {
        expect(object).to.be.a('array');
        if (done) done();
      });
  });

  //create: function(owner, apikey_alias, callback)
  it("(01) should be able to generate new API Key", function (done) {
    apikey.create(
      owner,
      "sample-key",
      (success, array_or_error) => {
        if (success) {
          generated_key_hash = sha256(array_or_error[0].key);
        } else {
          console.log("[spec] APIKey failed: ", { array_or_error });
        }
        expect(success).to.equal(true);
        expect(array_or_error[0].key).to.be.a('string');
        done();
      }
    );
  });

  it("(01b) should be able to generate another API Key", function (done) {
    apikey.create(
      owner,
      "sample-key-2",
      (success, array_or_error) => {
        expect(success).to.equal(true);
        expect(array_or_error[0].key).to.be.a('string');
        done();
      }
    );
  });

  it("(01b) should be able to generate Default MQTT API Key", function (done) {
    apikey.create(
      owner,
      "Default MQTT API Key",
      (success, array_or_error) => {
        if (success) {
          generated_key_hash = sha256(array_or_error[0].key);
        } else {
          console.log("[spec] APIKey failed: ", { array_or_error });
        }
        expect(success).to.equal(true);
        expect(array_or_error[0].key).to.be.a('string');
        done();
      }
    );
  });

  it("(02) should be able to list API Keys", function (done) {
    apikey.list(
      owner,
      (object) => {
        expect(object).to.be.a('array');
        done();
      });
  });

  //verify: function(owner, apikey, callback)
  it("(03) should be able to verify invalid API Keys", function (done) {
    apikey.verify(
      owner,
      "invalid-api-key",
      true,
      (success /*, result */) => { // fixed (callback is not a function!)
        expect(success).to.equal(false);
        done();
      });
  });

  //revoke: function(owner, apikey_hash, callback)
  it("04 - should be able to revoke API Keys", function (done) {
    apikey.create(
      owner,
      "sample-key-for-revocation",
      (success, array_or_error) => {
        expect(success).to.equal(true);
        console.log("[spec] APIKey revoking: sample-key-for-revocation from", { array_or_error });
        for (let index in array_or_error) {
          let item = array_or_error[index];
          if (item.alias.indexOf("sample-key-for-revocation") !== -1) {
            apikey.revoke(
              owner,
              [item.hash],
              (_success, /* result */) => {
                expect(_success).to.equal(true);
                done();
              });
          }
        }
      }
    );
  });

  it("(05) should return empty array  on invalid API Key revocation", function (done) {
    apikey.revoke(
      owner,
      ["sample-key-hax"], // intentionaly invalid
      (success) => {
        expect(success).to.equal(true);
        done();
      }
    );
  });

  //list: function(owner, callback)
  it("(06) should be able to list API Keys (2)", function (done) {
    apikey.list(
      owner,
      (object) => {
        expect(object).to.be.a('array');
        done();
      });
  });

  // currently fails, no key is being fetched
  it("(07) should be able to get first API Key (if exists)", function (done) {
    apikey.get_first_apikey(
      owner,
      (success, object) => {
        expect(success).to.equal(true);
        expect(object).to.be.a('string');
        done();
      });
  });

});

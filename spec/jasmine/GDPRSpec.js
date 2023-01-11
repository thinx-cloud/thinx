let Redis = require('redis');
let Globals = require('globals.js');

describe("GDPR", function () {

    var redis = null;

    beforeAll(async () => {
        console.log(`🚸 [chai] >>> running GDPR spec`);
        // Initialize Redis
        redis = Redis.createClient(Globals.redis_options());
        await redis.connect();
      });
    
      afterAll(() => {
        console.log(`🚸 [chai] <<< completed GDPR spec`);
      });
    

    var envi = require("../_envi.json");
    var expect = require('chai').expect;
    let GDPR = require("../../lib/thinx/gdpr");


    let mock_user = {
        last_update: 1649088795,
        owner: envi.oid,
        notifiedBeforeGDPRRemoval24: false,
        notifiedBeforeGDPRRemoval168: false
    };

    it("should not fail while scheduling guards", function () {
        let gdpr = new GDPR(redis);
        expect(gdpr.guard()).to.equal(true);
    }, 10000);

    it("should not fail while purging", function (done) {
        let gdpr = new GDPR(redis);
        gdpr.purgeOldUsers((result) => {
            expect(result).to.equal(true);
            done();
        });
    }, 10000);

    it("should not fail while notifying", function (done) {
        let gdpr = new GDPR(redis);
        gdpr.notifyOldUsers((result) => {
            expect(result).to.equal(true);
            done();
        });
    }, 10000);


    it("should notify 24 hours before deletion", function (done) {
        var d1 = new Date();
        d1.setMonth(d1.getMonth() - 3);
        d1.setDate(d1.getDay() - 1);
        d1.setHours(0, 0, 0, 0);
        let user = mock_user;
        user.last_update = d1;
        let gdpr = new GDPR(redis);
        gdpr.notify24(user, (error) => {
            if (error) console.log("[spec] 24 hours before deletion ERROR:", error);
            done();
        });
    }, 10000);

    it("should notify 3 months - 168 hours before deletion", function (done) {
        let gdpr = new GDPR(redis);
        var d2 = new Date();
        d2.setMonth(d2.getMonth() - 4);
        d2.setDate(d2.getDay() - 8);
        d2.setHours(0, 0, 0, 0);
        let user = mock_user;
        user.last_update = d2;
        gdpr.notify168(user, (error) => {
            if (error) console.log("[spec] 168 hours before deletion ERROR", error);
            done();
        });
    }, 10000);

});
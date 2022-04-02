/* Router integration test only; does not have to cover full unit functionality. */

const THiNX = require("../../thinx-core.js");

let chai = require('chai');
var expect = require('chai').expect;
let chaiHttp = require('chai-http');
chai.use(chaiHttp);

//
// Unauthenticated
//

describe("API Keys (noauth)", function () {

    let thx = new THiNX();

    beforeAll((done) => {
        thx.init(() => {
            done();
        });
    });

    // create
    it("POST /api/user/apikey", function (done) {
        chai.request(thx.app)
            .post('/api/user/apikey')
            .send({
                'alias': 'mock-apikey-alias'
            })
            .end((err, res) => {
                expect(res.status).to.equal(403);
                done();
            });
    }, 20000);

    // revoke
    it("POST /api/user/apikey/revoke", function (done) {
        chai.request(thx.app)
            .post('/api/user/apikey/revoke')
            .send({
                'alias': 'mock-apikey-alias'
            })
            .end((err, res) => {
                expect(res.status).to.equal(403);
                done();
            });
    }, 20000);

    // list
    it("GET /api/user/apikey/list", function (done) {
        chai.request(thx.app)
            .get('/api/user/apikey/list')
            .end((err, res) => {
                expect(res.status).to.equal(403);
                done();
            });
    }, 20000);
});

//
// Authenticated
//


describe("API Keys (JWT)", function () {

    let thx = new THiNX();
    let agent;
    let jwt;

    beforeAll((done) => {
        thx.init(() => {
            agent = chai.request.agent(thx.app);

            agent
                .post('/api/login')
                .send({ username: 'dynamic', password: 'dynamic', remember: false })
                .then(function (res) {
                    console.log(`[chai] beforeAll POST /api/login (valid) response: ${JSON.stringify(res)}`);
                    expect(res).to.have.cookie('x-thx-core');
                    let body = JSON.parse(res.text);
                    jwt = 'Bearer ' + body.access_token;
                    done();
                });
        });
    });

    afterAll((done) => {
        agent.close();
        done();
    });

    var created_api_key = null;
    var created_api_key_2 = null;

    // create
    it("POST /api/user/apikey (1)", function (done) {
        chai.request(thx.app)
            .post('/api/user/apikey')
            .set('Authorization', jwt)
            .send({
                'alias': 'mock-apikey-alias'
            })
            .end((err, res) => {
                //  {"success":true,"api_key":"9b7bd4f4eacf63d8453b32dbe982eea1fb8bbc4fc8e3bcccf2fc998f96138629","hash":"0a920b2e99a917a04d7961a28b49d05524d10cd8bdc2356c026cfc1c280ca22c"}
                expect(res.status).to.equal(200);
                let j = JSON.parse(res.text);
                expect(j.success).to.equal(true);
                expect(j.api_key).to.be.a('string');
                expect(j.hash).to.be.a('string');
                created_api_key = j.hash;
                done();
            });
    }, 20000);

    it("POST /api/user/apikey (2)", function (done) {
        chai.request(thx.app)
            .post('/api/user/apikey')
            .set('Authorization', jwt)
            .send({
                'alias': 'mock-apikey-alias-2'
            })
            .end((err, res) => {
                expect(res.status).to.equal(200);
                let j = JSON.parse(res.text);
                expect(j.success).to.equal(true);
                expect(j.api_key).to.be.a('string');
                expect(j.hash).to.be.a('string');
                created_api_key_2 = j.api_key;
                done();
            });
    }, 20000);

    // revoke
    it("POST /api/user/apikey/revoke (single)", function (done) {
        chai.request(thx.app)
            .post('/api/user/apikey/revoke')
            .set('Authorization', jwt)
            .send({
                'fingerprint': created_api_key
            })
            .end((err, res) => {
                expect(res.status).to.equal(200);
                let j = JSON.parse(res.text);
                expect(j.success).to.equal(true);
                expect(j.revoked).to.be.an('array');
                expect(j.revoked.length).to.equal(2);
                done();
            });
    }, 20000);

    it("POST /api/user/apikey/revoke (multiple)", function (done) {
        chai.request(thx.app)
            .post('/api/user/apikey/revoke')
            .set('Authorization', jwt)
            .send({
                'fingerprints': created_api_key_2
            })
            .end((err, res) => {
                //  {"revoked":["7663ca65a23d759485fa158641727597256fd7eac960941fbb861ab433ab056f"],"success":true}
                console.log(`[chai] POST /api/user/apikey/revoke (multiple) response: ${res.text}, status ${res.status}`);
                expect(res.status).to.equal(200);
                let j = JSON.parse(res.text);
                expect(j.success).to.equal(true);
                expect(j.revoked).to.be.an('array');
                expect(j.revoked.length).to.equal(1);
                done();
            });
    }, 20000);

    // list
    it("GET /api/user/apikey/list", function (done) {
        chai.request(thx.app)
            .get('/api/user/apikey/list')
            .set('Authorization', jwt)
            .end((err, res) => {
                expect(res.status).to.equal(200);
                let j = JSON.parse(res.text);
                expect(j.success).to.equal(true);
                expect(j.api_keys).to.be.an('array');
                expect(j.api_keys.length).to.equal(1);
                done();
            });
    }, 20000);
});

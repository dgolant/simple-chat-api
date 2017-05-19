var expect = require('expect.js');
let chai = require('chai');
let chaiHttp = require('chai-http');
let should = chai.should();


chai.use(chaiHttp);

var server = require('../app.js');

// For now we will only test certain GET calls
describe('test / and server', function() {
    it('GET / returns an array', function testBase(done) {
        chai.request(server)
            .get('/')
            .end((err, res) => {
                res.should.have.status(200);
                res.body.should.be.a('array');
                res.body.length.should.be.not.eql(0);
                done();
            });
    });
});


describe('test user routes', function() {
    it('GET / returns an array', function testBase(done) {
        chai.request(server)
            .get('/users/')
            .end((err, res) => {
                res.should.have.status(200);
                res.body.should.be.a('array');
                res.body.length.should.be.not.eql(0);
                done();
            });
    });
});

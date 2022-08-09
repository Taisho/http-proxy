import { setupOutgoing, setupSocket } from '../src/proxy/common.ts';
import { parse } from 'url';
import expect from 'expect.js';

describe('src/proxy/common.ts', function () {
    describe('#setupOutgoing', function () {
        it('should setup the correct headers', function () {
            var outgoing = {};
            setupOutgoing(outgoing,
                {
                    agent: '?',
                    target: {
                        host: 'hey',
                        hostname: 'how',
                        socketPath: 'are',
                        port: 'you',
                        searchParams: new URLSearchParams()
                    },
                    headers: { 'fizz': 'bang', 'overwritten': true },
                    localAddress: 'local.address',
                    auth: 'username:pass'
                },
                {
                    method: 'i',
                    url: 'am',
                    headers: { 'pro': 'xy', 'overwritten': false }
                });

            expect(outgoing.host).to.eql('hey');
            expect(outgoing.hostname).to.eql('how');
            expect(outgoing.socketPath).to.eql('are');
            expect(outgoing.port).to.eql('you');
            expect(outgoing.agent).to.eql('?');

            expect(outgoing.method).to.eql('i');
            expect(outgoing.path).to.eql('/am');

            expect(outgoing.headers.pro).to.eql('xy');
            expect(outgoing.headers.fizz).to.eql('bang');
            expect(outgoing.headers.overwritten).to.eql(true);
            expect(outgoing.localAddress).to.eql('local.address');
            expect(outgoing.auth).to.eql('username:pass');
        });

        it('should not override agentless upgrade header', function () {
            var outgoing = {};
            setupOutgoing(outgoing,
                {
                    agent: undefined,
                    target: {
                        host: 'hey',
                        hostname: 'how',
                        socketPath: 'are',
                        port: 'you',
                        searchParams: new URLSearchParams()
                    },
                    headers: { 'connection': 'upgrade' },
                },
                {
                    method: 'i',
                    url: 'am',
                    headers: { 'pro': 'xy', 'overwritten': false }
                });
            expect(outgoing.headers.connection).to.eql('upgrade');
        });

        it('should not override agentless connection: contains upgrade', function () {
            var outgoing = {};
            setupOutgoing(outgoing,
                {
                    agent: undefined,
                    target: {
                        host: 'hey',
                        hostname: 'how',
                        socketPath: 'are',
                        port: 'you',
                        searchParams: new URLSearchParams()
                    },
                    headers: { 'connection': 'keep-alive, upgrade' }, // this is what Firefox sets
                },
                {
                    method: 'i',
                    url: 'am',
                    headers: { 'pro': 'xy', 'overwritten': false }
                });
            expect(outgoing.headers.connection).to.eql('keep-alive, upgrade');
        });

        it('should override agentless connection: contains improper upgrade', function () {
            // sanity check on upgrade regex
            var outgoing = {};
            setupOutgoing(outgoing,
                {
                    agent: undefined,
                    target: {
                        host: 'hey',
                        hostname: 'how',
                        socketPath: 'are',
                        port: 'you',
                        searchParams: new URLSearchParams()
                    },
                    headers: { 'connection': 'keep-alive, not upgrade' },
                },
                {
                    method: 'i',
                    url: 'am',
                    headers: { 'pro': 'xy', 'overwritten': false }
                });
            expect(outgoing.headers.connection).to.eql('close');
        });

        it('should override agentless non-upgrade header to close', function () {
            var outgoing = {};
            setupOutgoing(outgoing,
                {
                    agent: undefined,
                    target: {
                        host: 'hey',
                        hostname: 'how',
                        socketPath: 'are',
                        port: 'you',
                        searchParams: new URLSearchParams()
                    },
                    headers: { 'connection': 'xyz' },
                },
                {
                    method: 'i',
                    url: 'am',
                    headers: { 'pro': 'xy', 'overwritten': false }
                });
            expect(outgoing.headers.connection).to.eql('close');
        });

        it('should set the agent to false if none is given', function () {
            var outgoing = {};

            setupOutgoing(outgoing, {
                target: new URL('http://localhost')
            }, { url: '/', headers: {} });

            expect(outgoing.agent).to.eql(false);
        });

        it('set the port according to the protocol', function () {
            var outgoing = {};
            setupOutgoing(outgoing,
                {
                    agent: '?',
                    target: {
                        host: 'how',
                        hostname: 'are',
                        socketPath: 'you',
                        protocol: 'https:',
                        searchParams: new URLSearchParams()
                    }
                },
                {
                    method: 'i',
                    url: 'am',
                    headers: { pro: 'xy' }
                });

            expect(outgoing.host).to.eql('how');
            expect(outgoing.hostname).to.eql('are');
            expect(outgoing.socketPath).to.eql('you');
            expect(outgoing.agent).to.eql('?');

            expect(outgoing.method).to.eql('i');
            expect(outgoing.path).to.eql('/am');
            expect(outgoing.headers.pro).to.eql('xy');

            expect(outgoing.port).to.eql(443);
        });

        it('should keep the original target path in the outgoing path', function () {
            var outgoing = {};
            setupOutgoing(outgoing, {
                target: {
                    pathname: 'some-path',
                    searchParams: new URLSearchParams()
                }
            }, { url: 'am', headers: {} });

            expect(outgoing.path).to.eql('some-path/am');
        });

        it('should keep the original forward path in the outgoing path', function () {
            var outgoing = {};
            setupOutgoing(outgoing, {
                target: {},
                forward: {
                    pathname: 'some-path'
                }
            }, { url: 'am', headers: {} }, 'forward');

            expect(outgoing.path).to.eql('some-path/am');
        });

        it('should properly detect https/wss protocol without the colon', function () {
            var outgoing = {};
            setupOutgoing(outgoing, {
                target: {
                    protocol: 'https',
                    host: 'whatever.com',
                    searchParams: new URLSearchParams()
                }
            }, { url: '/', headers: {} });

            expect(outgoing.port).to.eql(443);
        });

        it('should not prepend the target path to the outgoing path with prependPath = false', function () {
            var outgoing = {};
            setupOutgoing(outgoing, {
                target: {
                    pathname: 'hellothere',
                    searchParams: new URLSearchParams()
                },
                prependPath: false
            }, { url: 'hi', headers: {} });

            expect(outgoing.path).to.eql('/hi');
        })

        it('should properly join paths', function () {
            var outgoing = {};
            setupOutgoing(outgoing, {
                target: {
                    pathname: '/forward',
                    searchParams: new URLSearchParams()
                },
            }, { url: '/static/path', headers: {} });

            expect(outgoing.path).to.eql('/forward/static/path');
        })

        it('should not modify the query string', function () {
            var outgoing = {};
            setupOutgoing(outgoing, {
                target: {
                    pathname: '/forward',
                    searchParams: new URLSearchParams()
                },
            }, { url: '/?foo=bar//&target=http://foobar.com/?a=1%26b=2&other=2', headers: {} });

            expect(outgoing.path).to.eql('/forward/?foo=bar//&target=http://foobar.com/?a=1%26b=2&other=2');
        })

        //
        // This is the proper failing test case for the common.join problem
        //
        it.skip('should correctly format the toProxy URL', function () {
            var outgoing = {};
            var google = 'https://google.com'
            setupOutgoing(outgoing, {
                target: new URL('http://sometarget.com:80'),
                toProxy: true,
            }, { url: google });

            expect(outgoing.path).to.eql('/' + google);
        });

        it.skip('should not replace :\ to :\\ when no https word before', function () {
            var outgoing = {};
            var google = 'https://google.com:/join/join.js'
            setupOutgoing(outgoing, {
                target: new URL('http://sometarget.com:80'),
                toProxy: true,
            }, { url: google, headers: {} });

            expect(outgoing.path).to.eql('/' + google);
        });

        it.skip('should not replace :\ to :\\ when no https word before', function () {
            var outgoing = {};
            var google = 'http://google.com:/join/join.js'
            setupOutgoing(outgoing, {
                target: new URL('http://sometarget.com:80'),
                toProxy: true,
            }, { url: google, headers: {} });

            expect(outgoing.path).to.eql('/' + google);
        });

        describe('when using ignorePath', function () {
            it('should ignore the path of the `req.url` passed in but use the target path', function () {
                var outgoing = {};
                var myEndpoint = 'https://whatever.com/some/crazy/path/whoooo';
                setupOutgoing(outgoing, {
                    target: new URL(myEndpoint),
                    ignorePath: true
                }, { url: '/more/crazy/pathness', headers: {} });

                expect(outgoing.path).to.eql('/some/crazy/path/whoooo');
            });

            it('should ignore the path of the `req.url` passed in but use the target path with two unencoded urls as query parameters', function () {
                var outgoing = {};
                var myEndpoint = 'https://whatever.com/some/crazy/path/whoooo?redirectTo=https://example.com&secondaryRedirect=https://test.com';
                setupOutgoing(outgoing, {
                    target: new URL(myEndpoint),
                    ignorePath: true
                }, { url: '/more/crazy/pathness', headers: {} });

                expect(outgoing.path).to.eql(`/some/crazy/path/whoooo?redirectTo=${encodeURIComponent('https://example.com')}&secondaryRedirect=${encodeURIComponent('https://test.com')}`);
            });

            // Bugfix validation: 775, 959
            it('should ignore the path of the `req.url` passed in but use the target path with two unencoded slashes in a query parameter', function () {
                var outgoing = {};
                var myEndpoint = 'https://whatever.com/some/crazy/path/whoooo?key=//myValue';
                setupOutgoing(outgoing, {
                    target: new URL(myEndpoint),
                    ignorePath: true
                }, { url: '/more/crazy/pathness', headers: {} });

                expect(outgoing.path).to.eql(`/some/crazy/path/whoooo?key=${encodeURIComponent('//myValue')}`);
            });

            it('and prependPath: false, it should ignore path of target and incoming request', function () {
                var outgoing = {};
                var myEndpoint = 'https://whatever.com/some/crazy/path/whoooo';
                setupOutgoing(outgoing, {
                    target: new URL(myEndpoint),
                    ignorePath: true,
                    prependPath: false
                }, { url: '/more/crazy/pathness', headers: {} });

                expect(outgoing.path).to.eql('');
            });
        });

        describe('when using changeOrigin', function () {
            it('should correctly set the port to the host when it is a non-standard port using WHATWG URL', function () {
                var outgoing = {};
                var myEndpoint = 'https://myCouch.com:6984';
                setupOutgoing(outgoing, {
                    target: new URL(myEndpoint),
                    changeOrigin: true
                }, { url: '/', headers: {} });

                expect(outgoing.headers.host).to.eql('mycouch.com:6984');
            });

            it('should correctly set the port to the host when it is a non-standard port when setting host and port manually (which ignores port)', function () {
                var outgoing = {};
                setupOutgoing(outgoing, {
                    target: {
                        protocol: 'https:',
                        host: 'mycouch.com',
                        port: 6984
                    },
                    changeOrigin: true
                }, { url: '/' });
                expect(outgoing.headers.host).to.eql('mycouch.com:6984');
            })
        });

        it('should pass through https client parameters', function () {
            var outgoing = {};
            setupOutgoing(outgoing,
                {
                    agent: '?',
                    target: {
                        host: 'how',
                        hostname: 'are',
                        socketPath: 'you',
                        protocol: 'https:',
                        pfx: 'my-pfx',
                        key: 'my-key',
                        passphrase: 'my-passphrase',
                        cert: 'my-cert',
                        ca: 'my-ca',
                        ciphers: 'my-ciphers',
                        secureProtocol: 'my-secure-protocol',
                        servername: 'my-servername',
                    }
                },
                {
                    method: 'i',
                    url: 'am'
                });

            expect(outgoing.pfx).eql('my-pfx');
            expect(outgoing.key).eql('my-key');
            expect(outgoing.passphrase).eql('my-passphrase');
            expect(outgoing.cert).eql('my-cert');
            expect(outgoing.ca).eql('my-ca');
            expect(outgoing.ciphers).eql('my-ciphers');
            expect(outgoing.secureProtocol).eql('my-secure-protocol');
            expect(outgoing.servername).eql('my-servername');
        });

        it('should handle overriding the `method` of the http request', function () {
            var outgoing = {};
            setupOutgoing(outgoing, {
                target: parse('https://whooooo.com'),
                method: 'POST',
            }, { method: 'GET', url: '' });

            expect(outgoing.method).eql('POST');
        });

        // url.parse('').path => null
        it('should not pass null as last arg to #urlJoin', function () {
            var outgoing = {};
            setupOutgoing(outgoing, {
                target: {
                    path: '',
                    searchParams: new URLSearchParams()
                }
            }, { url: '', headers: {} });

            expect(outgoing.path).to.be('/');
        });

    });

    describe("when using followRedirects", function () {
        it('should pass all options', function () {
            var outgoing = {};
            setupOutgoing(outgoing,
                {
                    agent: '?',
                    target: {
                        host: 'how',
                        hostname: 'are',
                        socketPath: 'you',
                        protocol: 'https:'
                    },
                    followRedirects: {
                        maxRedirects: 5,
                        maxBodyLength: 10000000,
                        agents: { http: 'http', https: 'https' },
                        beforeRedirect: function (options, headers) {
                            options.agent = '??';
                        },
                        trackRedirects: true,
                    }
                },
                {
                    method: 'i',
                    url: 'am'
                });

            expect(outgoing.maxRedirects).to.eql(5);
            expect(outgoing.maxBodyLength).to.eql(10000000);
            expect(outgoing.agents.http).to.eql('http');
            expect(outgoing.agents.https).to.eql('https');
            var options = { agent: '?' };
            var headers = {};
            outgoing.beforeRedirect(options, headers);
            expect(options.agent).to.eql('??');
            expect(outgoing.trackRedirects).to.eql(true);
        });
    });

    describe('#setupSocket', function () {
        it('should setup a socket', function () {
            var socketConfig = {
                timeout: null,
                nodelay: false,
                keepalive: false
            },
                stubSocket = {
                    setTimeout: function (num) {
                        socketConfig.timeout = num;
                    },
                    setNoDelay: function (bol) {
                        socketConfig.nodelay = bol;
                    },
                    setKeepAlive: function (bol) {
                        socketConfig.keepalive = bol;
                    }
                },
                returnValue = setupSocket(stubSocket);

            expect(socketConfig.timeout).to.eql(0);
            expect(socketConfig.nodelay).to.eql(true);
            expect(socketConfig.keepalive).to.eql(true);
        });
    });
});

//. github.js
var express = require( 'express' ),
    bodyParser = require( 'body-parser' ),
    fs = require( 'fs' ),
    multer = require( 'multer' ),
    request = require( 'request' ),
    session = require( 'express-session' ),
    router = express();

var settings = require( '../settings' );

router.use( multer( { dest: '../tmp/' } ).single( 'file' ) );
router.use( bodyParser.urlencoded( { extended: true, limit: '10mb' } ) );
router.use( bodyParser.json() );

router.use( session({
  secret: 'githubapi',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,           //. https で使う場合は true
    maxage: 1000 * 60 * 60   //. 60min
  }
}));


router.get( '/login', function( req, res ){
  //. GitHub API V3
  //. https://docs.github.com/en/developers/apps/authorizing-oauth-apps
  res.redirect( 'https://github.com/login/oauth/authorize?client_id=' + settings.client_id + '&redirect_uri=' + settings.callback_url + '&scope=repo' );
});

router.get( '/logout', function( req, res ){
  if( req.session.oauth ){
    req.session.oauth = {};
  }
  res.contentType( 'application/json; charset=utf-8' );
  res.write( JSON.stringify( { status: true }, null, 2 ) );
  res.end();
});


router.get( '/callback', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  var code = req.query.code;
  var option = {
    url: 'https://github.com/login/oauth/access_token',
    form: { client_id: settings.client_id, client_secret: settings.client_secret, code: code, redirect_uri: settings.callback_url },
    method: 'POST'
  };
  request( option, async function( err, res0, body ){
    if( err ){
      console.log( { err } );
    }else{
      //. body = 'access_token=XXXXX&scope=YYYY&token_type=ZZZZ';
      var tmp1 = body.split( '&' );
      for( var i = 0; i < tmp1.length; i ++ ){
        var tmp2 = tmp1[i].split( '=' );
        if( tmp2.length == 2 && tmp2[0] == 'access_token' ){
          var access_token = tmp2[1];

          req.session.oauth = {};
          req.session.oauth.token = access_token;

          var u = await GetUser( access_token );
          //console.log( { u } );

          if( u ){
            req.session.oauth.id = u.id;
            req.session.oauth.login = u.login;
            req.session.oauth.name = u.name;
            req.session.oauth.email = u.email;
            req.session.oauth.avatar_url = u.avatar_url;
          }
        }
      }
    }
    //console.log( 'redirecting...' );
    res.redirect( '/' );
  });
});


router.post( '/init', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  var repo_owner_name = req.body.repo_owner_name; //. repo_owner_name = 'dotnsf/hello';
  if( req.session && req.session.oauth && req.session.oauth.token && repo_owner_name ){
    var r = await InitTargetRepo( req.session.oauth.token, repo_owner_name );
    //var r = await InitTargetRepo( settings.personal_access_token, repo_owner_name );  //. どっちのアクセストークンを使っても "Invalid requesst: nil is not an object" エラーになる。。
    console.log( { r } );
    res.write( JSON.stringify( r, null, 2 ) );
    res.end();
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { error: 'no access_token, nor repo_owner_name' }, null, 2 ) );
    res.end();
  }
});

router.get( '/me', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  if( req.session && req.session.oauth && req.session.oauth.token ){
    var option = {
      url: 'https://api.github.com/user',
      headers: { 'Authorization': 'token ' + req.session.oauth.token, 'User-Agent': 'git_init_board' },
      method: 'GET'
    };
    request( option, function( err, res0, body ){
      if( err ){
        console.log( { err } );
        res.status( 400 );
        res.write( JSON.stringify( err, null, 2 ) );
        res.end();
      }else{
        body = JSON.parse( body );
        //. body = { login: 'dotnsf', id: XXXXXX, avatar_url: 'xxx', name: 'きむらけい', email: 'xxx@xxx', created_at: 'XX', updated_at: 'XX', ... }

        res.write( JSON.stringify( body, null, 2 ) );
        res.end();
      }
    });
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { error: 'no access_token' }, null, 2 ) );
    res.end();
  }
});


router.get( '/repos', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  if( req.session && req.session.oauth && req.session.oauth.token && req.session.oauth.login ){
    var option = {
      url: 'https://api.github.com/users/' + req.session.oauth.login + '/repos',
      headers: { 'Authorization': 'token ' + req.session.oauth.token, 'User-Agent': 'git_init_board', 'Accept': 'application/vnd.github.v3+json' },
      method: 'GET'
    };
    request( option, function( err, res0, body ){
      if( err ){
        console.log( { err } );
        res.status( 400 );
        res.write( JSON.stringify( err, null, 2 ) );
        res.end();
      }else{
        body = JSON.parse( body );
        //. body = { login: 'dotnsf', id: XXXXXX, avatar_url: 'xxx', name: 'きむらけい', email: 'xxx@xxx', created_at: 'XX', updated_at: 'XX', ... }
        res.write( JSON.stringify( body, null, 2 ) );
        res.end();
      }
    });
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { error: 'no access_token' }, null, 2 ) );
    res.end();
  }
});

router.get( '/isLoggedIn', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  var user = ( req.session && req.session.oauth && req.session.oauth.token ? req.session.oauth : null );
  var status = ( user ? req.session.oauth.token : null );

  if( !status ){
    res.status( 400 );
  }

  res.write( JSON.stringify( { status: status, user: user }, null, 2 ) );
  res.end();
});


//. ID作成用関数
function generateId(){
  var s = 1000;
  var id = '' + ( new Date().getTime().toString(16) ) + Math.floor( s * Math.random() ).toString(16);

  return id;
}


async function GetAllLabels( access_token, repo_owner_name ){
  return new Promise( async function( resolve, reject ){
    if( access_token && repo_owner_name ){
      //. repo_owner_name = 'dotnsf/hello';
      var option1 = {
        url: 'https://api.github.com/repos/' + repo_owner_name + '/labels',
        headers: { 'Authorization': 'token ' + access_token, 'User-Agent': 'git_init_board' },
        method: 'GET'
      };
      request( option1, async function( err1, res1, body1 ){
        if( err1 ){
          console.log( { err1 } );
          resolve( false );
        }else{
          body1 = JSON.parse( body1 );
          //console.log( { body1 } );  //. body1 = [ { url: "https://api.github.com/repos/dotnsf/hello/labels/bug", name: "bug", color: "fc2929" }, { .. } ]
          resolve( body1 );
        }
      });
    }else{
      resolve( false );
    }
  });
}


async function CreateLabel( access_token, repo_owner_name, name, description, color ){
  return new Promise( async function( resolve, reject ){
    if( access_token && repo_owner_name ){
      //. repo_owner_name = 'dotnsf/hello';
      var option1 = {
        url: 'https://api.github.com/repos/' + repo_owner_name + '/labels',
        headers: { 'Authorization': 'token ' + access_token, 'User-Agent': 'git_init_board', 'Content-Type': 'application/json;charset=utf-8' },
        data: { name: name, description: description, color: color },
        method: 'POST'
      };
      request( option1, async function( err1, res1, body1 ){
        if( err1 ){
          console.log( { err1 } );
          resolve( false );
        }else{
          //body1 = JSON.parse( body1 );
          resolve( true );
        }
      });
    }else{
      resolve( false );
    }
  });
}


async function DeleteLabel( access_token, repo_owner_name, name ){
  return new Promise( async function( resolve, reject ){
    if( access_token && repo_owner_name ){
      //. repo_owner_name = 'dotnsf/hello';
      var option1 = {
        url: 'https://api.github.com/repos/' + repo_owner_name + '/labels/' + name,
        headers: { 'Authorization': 'token ' + access_token, 'User-Agent': 'git_init_board' },
        method: 'DELETE'
      };
      request( option1, async function( err1, res1, body1 ){
        if( err1 ){
          console.log( { err1 } );
          resolve( false );
        }else{
          //body1 = JSON.parse( body1 );
          resolve( true );
        }
      });
    }else{
      resolve( false );
    }
  });
}


async function DeleteAllLabels( access_token, repo_owner_name ){
  return new Promise( async function( resolve, reject ){
    if( access_token && repo_owner_name ){
      //. repo_owner_name = 'dotnsf/hello';
      var labels = await GetAllLabels( access_token, repo_owner_name );
      if( labels ){
        var cnt = 0;
        if( labels.length ){
          for( var i = 0; i < labels.length; i ++ ){
            var label = labels[i];
            var r = await DeleteLabel( access_token, repo_owner_name, label.name );
            if( r ){
               cnt ++;
            }
          }
        }

        resolve( cnt );
      }else{
        resolve( false );
      }
    }else{
      resolve( false );
    }
  });
}


async function GetAllMilestones( access_token, repo_owner_name ){
  return new Promise( async function( resolve, reject ){
    if( access_token && repo_owner_name ){
      //. repo_owner_name = 'dotnsf/hello';
      var option1 = {
        url: 'https://api.github.com/repos/' + repo_owner_name + '/milestones',
        headers: { 'Authorization': 'token ' + access_token, 'User-Agent': 'git_init_board' },
        method: 'GET'
      };
      request( option1, async function( err1, res1, body1 ){
        if( err1 ){
          console.log( { err1 } );
          resolve( false );
        }else{
          body1 = JSON.parse( body1 );
          //console.log( { body1 } );  //. body1 = [ { url: "https://api.github.com/repos/dotnsf/hello/labels/bug", name: "bug", color: "fc2929" }, { .. } ]
          resolve( body1 );
        }
      });
    }else{
      resolve( false );
    }
  });
}


async function CreateMilestone( access_token, repo_owner_name, title, state, description, due_on ){
  return new Promise( async function( resolve, reject ){
    if( access_token && repo_owner_name ){
      //. repo_owner_name = 'dotnsf/hello';
      var option1 = {
        url: 'https://api.github.com/repos/' + repo_owner_name + '/milestones',
        headers: { 'Authorization': 'token ' + access_token, 'User-Agent': 'github_init_board', 'Content-Type': 'application/json;charset=utf-8' },
        data: { title: title, state: state, description: description, due_on: due_on },
        method: 'POST'
      };
      request( option1, async function( err1, res1, body1 ){
        if( err1 ){
          console.log( { err1 } );
          resolve( false );
        }else{
          resolve( true );
        }
      });
    }else{
      resolve( false );
    }
  });
}


async function DeleteMilestone( access_token, repo_owner_name, milestone_number ){
  return new Promise( async function( resolve, reject ){
    if( access_token && repo_owner_name ){
      //. repo_owner_name = 'dotnsf/hello';
      var option1 = {
        url: 'https://api.github.com/repos/' + repo_owner_name + '/milestones/' + milestone_number,
        headers: { 'Authorization': 'token ' + access_token, 'User-Agent': 'github_init_board' },
        method: 'DELETE'
      };
      request( option1, async function( err1, res1, body1 ){
        if( err1 ){
          console.log( { err1 } );
          resolve( false );
        }else{
          //body1 = JSON.parse( body1 );
          resolve( true );
        }
      });
    }else{
      resolve( false );
    }
  });
}


async function DeleteAllMilestones( access_token, repo_owner_name ){
  return new Promise( async function( resolve, reject ){
    if( access_token && repo_owner_name ){
      //. repo_owner_name = 'dotnsf/hello';
      var milestones = await GetAllMilestones( access_token, repo_owner_name );
      if( milestones ){
        var cnt = 0;
        if( milestones.length ){
          for( var i = 0; i < milestones.length; i ++ ){
            var milestone = milestones[i];
            var r = await DeleteMilestone( access_token, repo_owner_name, milestone.number );
            if( r ){
               cnt ++;
            }
          }
        }

        resolve( cnt );
      }else{
        resolve( false );
      }
    }else{
      resolve( false );
    }
  });
}

async function GetAllIssues( access_token, repo_owner_name ){
  return new Promise( async function( resolve, reject ){
    if( access_token && repo_owner_name ){
      //. repo_owner_name = 'dotnsf/hello';
      var option1 = {
        url: 'https://api.github.com/repos/' + repo_owner_name + '/issues',
        headers: { 'Authorization': 'token ' + access_token, 'User-Agent': 'git_init_board' },
        method: 'GET'
      };
      request( option1, async function( err1, res1, body1 ){
        if( err1 ){
          console.log( { err1 } );
          resolve( false );
        }else{
          body1 = JSON.parse( body1 );
          resolve( body1 );
        }
      });
    }else{
      resolve( false );
    }
  });
}


async function CreateIssue( access_token, repo_owner_name, issue_title, issue_body, issue_assignee, issue_milestone, issue_labels ){
  return new Promise( async function( resolve, reject ){
    if( access_token && repo_owner_name ){
      //. repo_owner_name = 'dotnsf/hello';
      var option1 = {
        url: 'https://api.github.com/repos/' + repo_owner_name + '/issues',
        headers: { 'Authorization': 'token ' + access_token, 'User-Agent': 'github_init_board', 'Content-Type': 'application/json;charset=utf-8', 'Accept': 'application/vnd.github+json' },
        data: { title: issue_title, body: issue_body /*, assignee: issue_assignee*/ /*, milestone: issue_milestone*/ , labels: issue_labels },
        method: 'POST'
      };
      request( option1, async function( err1, res1, body1 ){
        if( err1 ){
          console.log( { err1 } );
          resolve( false );
        }else{
          console.log( { body1 } );  /* body1 = { message: "Invalid request.\\n\\nFor 'links/0/schema'"} */
          resolve( true );
        }
      });
    }else{
      resolve( false );
    }
  });
}


async function GetInitJson( target ){
  return new Promise( async function( resolve, reject ){
    if( target ){
      console.log( __dirname );
      try{
        //fs.readFile( '../init_' + target + '.json', 'utf-8', function( err, lines ){
        fs.readFile( './init_' + target + '.json', 'utf-8', function( err, lines ){
          if( err ){
            console.log( err );
            resolve( false );
          }else{
            resolve( JSON.parse( lines ) );
          }
        });
      }catch( e ){
        console.log( e );
        resolve( false );
      }
    }else{
      resolve( false );
    }
  });
}


async function InitTargetRepo( access_token, repo_owner_name ){
  return new Promise( async function( resolve, reject ){
    if( access_token && repo_owner_name ){
      //. repo_owner_name = 'dotnsf/hello';
      var cnt1 = 0;
      var r1 = await DeleteAllLabels( access_token, repo_owner_name );
      var init_labels = await GetInitJson( 'labels' );
      if( init_labels ){
        for( var i = 0; i < init_labels.length; i ++ ){
          var init_label = init_labels[i];
          var r = await CreateLabel( access_token, repo_owner_name, init_label.name, init_label.description, init_label.color );
          if( r ){ cnt1 ++; }
        }
      }

      var cnt2 = 0;
      var r2 = await DeleteAllMilestones( access_token, repo_owner_name );
      var init_milestones = await GetInitJson( 'milestones' );
      if( init_milestones ){
        for( var i = 0; i < init_milestones.length; i ++ ){
          var init_milestone = init_milestones[i];
          var r = await CreateMilestone( access_token, repo_owner_name, init_milestone.title, init_milestone.state, init_milestone.description, init_milestone.due_on );
          if( r ){ cnt2 ++; }
        }
      }

      var cnt3 = 0;
      var init_issues = await GetInitJson( 'issues' );
      if( init_issues ){
        for( var i = 0; i < init_issues.length; i ++ ){
          var init_issue = init_issues[i];
          var r = await CreateIssue( access_token, repo_owner_name, init_issue.title, init_issue.body, [], null/*init_issue.milestone*/, init_issue.labels );
          if( r ){ cnt3 ++; }
        }
      }
      
      resolve( { labels: cnt1, milestones: cnt2, issues: cnt3 } );
    }else{
      resolve( false );
    }
  });
}

//. git branch
async function GetUser( access_token ){
  return new Promise( async function( resolve, reject ){
    if( access_token ){
      var option = {
        url: 'https://api.github.com/user',
        headers: { 'Authorization': 'token ' + access_token, 'User-Agent': 'githubapi' },
        method: 'GET'
      };
      request( option, async function( err, res0, body ){
        if( err ){
          console.log( { err } );
          resolve( false );
        }else{
          body = JSON.parse( body );
          //. body = { login: 'dotnsf', id: XXXXXX, avatar_url: 'xxx', name: 'きむらけい', email: 'xxx@xxx', created_at: 'XX', updated_at: 'XX', ... }

          resolve( body );
        }
      });
    }else{
      resolve( false );
    }
  });
}


//. router をエクスポート
module.exports = router;

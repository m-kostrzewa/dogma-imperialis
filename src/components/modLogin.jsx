// import React from 'react';
import * as React from "react";

import {FirebaseContext} from './firebase';


class ModLogin extends React.Component {
  static contextType = FirebaseContext;
  constructor(props) {
    super(props);

    this.onSignIn = this.onSignIn.bind(this);
    this.onSignOut = this.onSignOut.bind(this);

    this.state = {
        currentUser: "",
    }
  }

  componentDidMount() {
    this.context.setOnSignCallback( (user) => {
        if(user) {
            if(user.uid !== "gmhoL3b4R1cRajWnAYBcm4vB9oX2") {
                console.log("Not moderator, logging out to prevent user confusion.");
                this.context.signOut();
            } else {
                this.setState({
                    currentUser: user.displayName,
                });
            }
        } else {
            this.setState({
                currentUser: "",
            });
        }

    })
  }

  onSignIn(e) {
    e.preventDefault();
    this.context.signIn();
  }

  onSignOut(e) {
    e.preventDefault();
    this.context.signOut();
  }

  render() {
    return (<div>
        {this.state.currentUser ? <a href="#" onClick={this.onSignOut}>{this.state.currentUser} - Log out</a> : <a href="#" onClick={this.onSignIn}>Moderator log in</a>}
    </div>)
  }
}

export default ModLogin;

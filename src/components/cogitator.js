import React from 'react';
import ReactDOM from 'react-dom';

import DebouncedSearchBox from './debouncedSearch';

import './cogitator.css';


class CogitatorComponent extends React.Component {

    render() {
        return (
        <div class="cogitator-body">
            <div class="cogitator">
                <DebouncedSearchBox />
            </div>
        </div>
      );
    }
}

export default CogitatorComponent;

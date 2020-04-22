import React from 'react';
import ReactDOM from 'react-dom';


import algoliasearch from 'algoliasearch/lite';
import { InstantSearch, Hits } from 'react-instantsearch-dom';

import DebouncedSearchBox from './debouncedSearch';

import './cogitator.css';

const searchClient = algoliasearch(
    'YYX0J9QPH2',
    '7d0acf207476e6e99fb6caea9b526637'
);

class CogitatorComponent extends React.Component {

    render() {
        return (
        <div class="cogitator-body">
            <input type="checkbox" id="cogitator-expand"/>
            <div class="cogitator">
                <p>Cogitator</p>

                <InstantSearch
                    indexName="prod_QUOTES"
                    searchClient={searchClient}
                >
                    <DebouncedSearchBox />
                    <Hits />
                </InstantSearch>
                <form>
                    <div class="submenu-div">
                        <label class="submenu-expand-label" for="realspace-submenu-expand">filter_realspace_sources_ ></label>
                        <input type="checkbox" id="realspace-submenu-expand" class="submenu-expand"/>
                        <fieldset>
                            <ul>
                                <li>
                                    <label>
                                    <input type="checkbox" name="realspace_archive" value="Warhammer 40,000: Mechanicus" />
                                        Warhammer 40,000: Mechanicus
                                    </label>
                                </li>
                                <li>
                                    <label>
                                    <input type="checkbox" name="realspace_archive" value="Warhammer 40,000: Space Marine" />
                                        Warhammer 40,000: Space Marine
                                    </label>
                                </li>
                                <li>
                                    <label>
                                    <input type="checkbox" name="realspace_archive" value="Warhammer 40,000: Dawn of War" />
                                        Warhammer 40,000: Dawn of War
                                    </label>
                                </li>
                                <li>
                                    <label>
                                    <input type="checkbox" name="realspace_archive" value="Eisenhorn Trilogy" />
                                        Eisenhorn Trilogy
                                    </label>
                                </li>
                            </ul>
                        </fieldset>
                    </div>

                    <div class="submenu-div">
                        <label class="submenu-expand-label" for="lore-submenu-expand">filter_lore_sources_ ></label>
                        <input type="checkbox" id="lore-submenu-expand" class="submenu-expand"/>
                        <fieldset>
                            <ul>
                                <li>
                                    <label>
                                    <input type="checkbox" name="lore_archive" value="Adeptus Mechanicus" />
                                        Adeptus Mechanicus
                                    </label>
                                </li>
                                <li>
                                <label>
                                    <input type="checkbox" name="lore_archive" value="Adeptus Astartes" />
                                        Adeptus Astartes
                                    </label>
                                </li>
                            </ul>
                        </fieldset>
                    </div>

                    <div class="submenu-div">
                        <input type="submit" value="query_data_looms_"/>
                        <span><input type="text" value="topic_"/></span>
                    </div>
                </form>
            </div>
            <label id="cogitator-expand-label" for="cogitator-expand">toggle_cogitator_console_</label>
        </div>
      );
    }
}

export default CogitatorComponent;

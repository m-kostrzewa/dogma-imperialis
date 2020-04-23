import React from 'react';
import ReactDOM from 'react-dom';

import DebouncedSearchBox from './debouncedSearch';

import './cogitator.css';


class CogitatorComponent extends React.Component {

    render() {
        return (
        <div class="cogitator-body">
            <input type="checkbox" id="cogitator-expand"/>
            <div class="cogitator">
                <p>Cogitator</p>


{/*

                <InstantSearch
                    indexName="prod_QUOTES"
                    searchClient={searchClient}
                >
                    <DebouncedSearchBox />
                    <Hits hitComponent={Hit} />
                </InstantSearch> */}
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

                    <DebouncedSearchBox />
                </form>
            </div>
            <label id="cogitator-expand-label" for="cogitator-expand">toggle_cogitator_console_</label>
        </div>
      );
    }
}

export default CogitatorComponent;

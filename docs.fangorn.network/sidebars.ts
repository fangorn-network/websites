import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docs: [
    'intro',
    {type: 'category', label: 'Use', collapsed: false, items: ['use-apps', 'index-skill']},
    {type: 'category', label: 'Build', collapsed: false, items: ['build-an-app', 'sell-records']},
    {type: 'category', label: 'Network', collapsed: false, items: ['how-it-works', 'deploy']},
  ],
};

export default sidebars;

import type {World} from '../../shared/src/types';
import {clockTick} from './world';
import {residentTick,basicProduction} from '../../residents/src/simulation';
import {socialTick} from '../../agent-runtime/src/social';
import {scheduleJobs} from '../../agent-runtime/src/jobs';
import {economyTick} from '../../economy/src/economy';
import {constructionTick} from '../../city-planning/src/construction';
import {environmentTick} from './environment';
import {expansionTick} from './expansion';
import {civilizationTick} from './civilization';
export function simulate(w:World){const before=w.gameTime;clockTick(w);const dt=w.gameTime-before;environmentTick(w,dt);economyTick(w,dt);residentTick(w,dt);socialTick(w);constructionTick(w,dt);expansionTick(w);civilizationTick(w,dt);scheduleJobs(w);}

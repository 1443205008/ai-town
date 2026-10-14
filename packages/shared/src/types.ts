export type Point = {x:number;y:number};
export type Structure = Point & {id:string;type:string;name:string;width:number;height:number;durability:number;operational:boolean};
export type TownMap = {width:number;height:number;tileSize:number;terrain:number[];elevation:number[];resource_nodes:Array<Point & {type:string}>;roads:Point[];zoning:Array<Point & {zone:string}>;structures:Structure[];blueprints:any[];navigation:number[];fog_of_war:boolean[]};
export type WorldEvent = {id:string;world_id:string;event_seq:number;game_time:number;type:string;actor:string;payload:Record<string,any>;visibility:string[]|'PUBLIC';command_id:string};
export type World = {id:string;name:string;seed:number;scenarioId:string;version:number;gameTime:number;running:boolean;speed:number;nextTickAt:number;eventSeq:number;map:TownMap;resources:Record<string,number>;residents:any[];proposals:any[];projects:any[];conversations:any[];events:WorldEvent[];settings:Record<string,any>;[key:string]:any};

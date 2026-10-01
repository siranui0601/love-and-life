/** Consume all foreground elapsed time in bounded physics steps, including low FPS. */
export function advanceElapsed(seconds,advance){
 if(!Number.isFinite(seconds)||seconds<0)throw new RangeError('Invalid elapsed time');
 const steps=Math.ceil(seconds/.05);
 for(let i=0;i<steps;i++)advance(seconds/steps);
}

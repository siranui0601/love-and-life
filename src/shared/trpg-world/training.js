export function lessonFor(skill) {
 return {sessionsRequired:Math.max(1,skill.training?.sessionsRequired??2),seconds:Math.max(60,skill.training?.seconds??1800),equipment:skill.training?.equipment||[],...skill.training};
}
export function recordLesson(state,skill,teacher,completed) {
 const p=state.player;p.training||={};const course=p.training[skill.id]||={skillId:skill.id,lessons:[],mastery:0};const lesson=lessonFor(skill);
 course.lessons.push({teacherId:teacher.id,location:{region:p.region,position:[...teacher.position]},completedAt:state.time,completed,duration:lesson.seconds,prerequisites:[...(skill.requires||[])],equipment:[...lesson.equipment]});
 if(completed)course.mastery=Math.min(1,course.mastery+1/lesson.sessionsRequired);
 return course;
}

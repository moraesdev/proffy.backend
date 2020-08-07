import { Request, Response } from 'express';
import db from "../database/connection";
import convertHourToMinutes from "../utils/convertHourToMinutes";

interface ScheduleItem {
  wek_day: number;
  from: string;
  to: string;
}

export default class ClassesController {
  async index(req: Request, res: Response) { 
    const filters = req.query;

    if (!filters.wek_day || !filters.subject || !filters.time) {
      return res.status(400).json({
        error: 'Favor informar os filtros'
      });
    }

    const timeinMinutes = convertHourToMinutes(filters.time as string);

    const classes = await db('classes')
      .whereExists(function() {
        this.select('class_schedule.*')
          .from('class_schedule')
          .whereRaw('`class_schedule`.`class_id` = `classes`.`id`')
          .whereRaw('`class_schedule`.`wek_day` = ??', [Number(filters.wek_day)])
          .whereRaw('`class_schedule`.`from` <= ??', [timeinMinutes])
          .whereRaw('`class_schedule`.`to` > ??', [timeinMinutes])
      })

      .where('classes.subject', '=', filters.subject as string)
      .join('users', 'classes.user_id', '=', 'users.id')
      .select(['classes.*', 'users.*']);

    return res.json(classes);
  }

  async create(req: Request, res: Response) {
    const { 
      name,
      avatar,
      whatsapp,
      bio,
      subject,
      cost,
      schedule
    } = req.body;
  
    const trx = await db.transaction();
  
    try {
      const insertedUsersIds = await trx('users').insert({
        name,
        avatar,
        whatsapp,
        bio
      });
  
      const user_id = insertedUsersIds[0];
  
      const insertedClassesIds = await trx('classes').insert({
        subject,
        cost,
        user_id
      })
  
      const class_id = insertedClassesIds[0];
  
      const classSchedule = schedule.map((scheduleItem: ScheduleItem) => {
        return {
          class_id,
          wek_day: scheduleItem.wek_day,
          from: convertHourToMinutes(scheduleItem.from),
          to: convertHourToMinutes(scheduleItem.to),
        };
      });
  
      await trx('class_schedule').insert(classSchedule);
    
  
      await trx.commit();
  
      return res.status(201).send();
    } catch (err) {
      await trx.rollback();
  
      return res.status(400).json({
        error: 'Erro inesperado ao criar uma nova class'
      });
    }
  }
}
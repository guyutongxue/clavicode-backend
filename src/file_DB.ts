import {FileModel, File} from './helpers/db';
import moment from 'moment';
import {unlink} from 'fs';

export async function save(file: File): Promise<boolean>{
    const file_ = new FileModel(file);
    await file_.save().catch(()=>{
        console.log('save error');
        return false;
    });
    return true;
}


export async function query(id: number): Promise<string>{
    // auto insert a new k - v pair
    const file = await FileModel.findOne({id: id});
    if(file){
        const file_ = new FileModel({id: file.id, path: file.path});
        if (file.email)
            file_.email = file.email;
        await file_.save().catch(()=>{
            console.log('save error');
        });
        // not delete here incase of double delete.
        return file.path;
    } 
    return "";
}

export async function refresh(): Promise<void>{
    const expireTime = moment().subtract(10, 'minute').toDate();
    (await FileModel.find({createdAt: {$lte: expireTime}})).forEach(function (record){
        unlink(record.path, (err)=>{console.log(err);});
    });
    await FileModel.deleteMany({createdAt: {$lte: expireTime}});
    return;
}

export class Timer{
    func: ()=>void;
    timeout: number;
    constructor(func_: ()=>void, timeout_ = 1000 * 60){
        this.func = func_;
        this.timeout = timeout_;
    }
    async run(){
        setTimeout(()=>{
            this.func();
            this.run();
        }, this.timeout);
    }
}
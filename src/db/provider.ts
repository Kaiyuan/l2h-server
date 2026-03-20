export interface DBProvider {
    prepare(sql: string): any;
    exec(sql: string): void;
    transaction(fn: (data: any) => void): (data: any) => void;
}

export interface Statement {
    run(...params: any[]): { lastInsertRowid: number | bigint; changes: number };
    get(...params: any[]): any;
    all(...params: any[]): any[];
}

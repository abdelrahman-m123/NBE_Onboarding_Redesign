import { Injectable } from '@nestjs/common'
import type { QueryResult, QueryResultRow } from 'pg'
import { query } from './db.js'

@Injectable()
export class DatabaseService {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    return query<T>(text, params)
  }
}

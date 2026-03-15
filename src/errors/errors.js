/*
  Ошибка для обозначения неверного токена
*/
export class TokenError extends Error {
  constructor(message) {
    super(message)
    this.name = "TokenError"
  }
}

/*
  Ошибка для обозначения ошибки на стороне сервера
*/
export class ServiceError extends Error {
  constructor(message) {
    super(message)
    this.name = "ServiceError"
  }
}

/*
  Ошибка для обозначения неверно переданных аргументов серверу
*/
export class PostArgumentsError extends Error {
  constructor(message) {
    super(message)
    this.name = "PostArgumentsError"
  }
}

/*
  Ошибка для обозначения отсутствия результатов
*/
export class NoResults extends Error {
  constructor(message) {
    super(message)
    this.name = "NoResults"
  }
}

/*
  Ошибка для обозначения неожиданного или необработанного поведения
*/
export class UnexpectedBehavior extends Error {
  constructor(message) {
    super(message)
    this.name = "UnexpectedBehavior"
  }
}

/*
  Ошибка для обозначения не найденного запрашиваемого качества видео
*/
export class QualityNotFound extends Error {
  constructor(message) {
    super(message)
    this.name = "QualityNotFound"
  }
}

/*
  Ошибка для обозначения что контент заблокирован из-за возрастного рейтинга
*/
export class AgeRestricted extends Error {
  constructor(message) {
    super(message)
    this.name = "AgeRestricted"
  }
}

/*
  Ошибка для обозначения ошибки 429 из-за слишком частых запросов.
  В основном для шикимори
*/
export class TooManyRequests extends Error {
  constructor(message) {
    super(message)
    this.name = "TooManyRequests"
  }
}

/*
  Ошибка для обозначения заблокированного контента/плеера
*/
export class ContentBlocked extends Error {
  constructor(message) {
    super(message)
    this.name = "ContentBlocked"
  }
}

/*
  Ошибка для обозначения http кода 520
  Используется в парсере shikimori
*/
export class ServiceIsOverloaded extends Error {
  constructor(message) {
    super(message)
    this.name = "ServiceIsOverloaded"
  }
}

/*
  При попытке дешифровать ссылку от Kodik возникла ошибка
*/
export class DecryptionFailure extends Error {
  constructor(message) {
    super(message)
    this.name = "DecryptionFailure"
  }
}

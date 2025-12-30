import { Buffer } from 'buffer'
import WebSocket from 'ws'

/**
 * Event type definitions
 */
export enum EventType {
  None = 0,
  StartConnection = 1,
  FinishConnection = 2,
  ConnectionStarted = 50,
  ConnectionFailed = 51,
  ConnectionFinished = 52,
  StartSession = 100,
  CancelSession = 101,
  FinishSession = 102,
  SessionStarted = 150,
  SessionCanceled = 151,
  SessionFinished = 152,
  SessionFailed = 153,
  UsageResponse = 154,
  TaskRequest = 200,
  UpdateConfig = 201,
  AudioMuted = 250,
  SayHello = 300,
  TTSSentenceStart = 350,
  TTSSentenceEnd = 351,
  TTSResponse = 352,
  TTSEnded = 359,
}

/**
 * Message protocol related definitions
 */
export enum MsgType {
  Invalid = 0,
  FullClientRequest = 0b1,
  AudioOnlyClient = 0b10,
  FullServerResponse = 0b1001,
  AudioOnlyServer = 0b1011,
  FrontEndResultServer = 0b1100,
  Error = 0b1111,
}

export enum MsgTypeFlagBits {
  NoSeq = 0,
  PositiveSeq = 0b1,
  LastNoSeq = 0b10,
  NegativeSeq = 0b11,
  WithEvent = 0b100,
}

export enum VersionBits {
  Version1 = 1,
}

export enum HeaderSizeBits {
  HeaderSize4 = 1,
}

export enum SerializationBits {
  JSON = 0b1,
}

export enum CompressionBits {
  None = 0,
}

/**
 * Protocol message structure
 */
export interface Message {
  version: VersionBits
  headerSize: HeaderSizeBits
  type: MsgType
  flag: MsgTypeFlagBits
  serialization: SerializationBits
  compression: CompressionBits
  event?: EventType
  sessionId?: string
  connectId?: string
  sequence?: number
  errorCode?: number
  payload: Uint8Array
}

export function createMessage(msgType: MsgType, flag: MsgTypeFlagBits): Message {
  return {
    type: msgType,
    flag: flag,
    version: VersionBits.Version1,
    headerSize: HeaderSizeBits.HeaderSize4,
    serialization: SerializationBits.JSON,
    compression: CompressionBits.None,
    payload: new Uint8Array(0),
  }
}

/**
 * Message serialization
 */
export function marshalMessage(msg: Message): Uint8Array {
  const buffers: Uint8Array[] = []

  // Build base header
  const headerSize = 4 * msg.headerSize
  const header = new Uint8Array(headerSize)

  header[0] = (msg.version << 4) | msg.headerSize
  header[1] = (msg.type << 4) | msg.flag
  header[2] = (msg.serialization << 4) | msg.compression

  buffers.push(header)

  // Write fields based on message type and flags
  if (msg.flag === MsgTypeFlagBits.WithEvent) {
    if (msg.event !== undefined) {
      const eventBuffer = new ArrayBuffer(4)
      const eventView = new DataView(eventBuffer)
      eventView.setInt32(0, msg.event, false)
      buffers.push(new Uint8Array(eventBuffer))
    }

    // Write session ID for non-connection events
    if (
      msg.event !== EventType.StartConnection &&
      msg.event !== EventType.FinishConnection &&
      msg.event !== EventType.ConnectionStarted &&
      msg.event !== EventType.ConnectionFailed
    ) {
      const sessionId = msg.sessionId || ''
      const sessionIdBytes = Buffer.from(sessionId, 'utf8')
      const sizeBuffer = new ArrayBuffer(4)
      const sizeView = new DataView(sizeBuffer)
      sizeView.setUint32(0, sessionIdBytes.length, false)

      const result = new Uint8Array(4 + sessionIdBytes.length)
      result.set(new Uint8Array(sizeBuffer), 0)
      result.set(sessionIdBytes, 4)
      buffers.push(result)
    }
  }

  // Write sequence if needed
  if (
    msg.flag === MsgTypeFlagBits.PositiveSeq ||
    msg.flag === MsgTypeFlagBits.NegativeSeq
  ) {
    if (msg.sequence !== undefined) {
      const seqBuffer = new ArrayBuffer(4)
      const seqView = new DataView(seqBuffer)
      seqView.setInt32(0, msg.sequence, false)
      buffers.push(new Uint8Array(seqBuffer))
    }
  }

  // Write error code for error messages
  if (msg.type === MsgType.Error && msg.errorCode !== undefined) {
    const errorBuffer = new ArrayBuffer(4)
    const errorView = new DataView(errorBuffer)
    errorView.setInt32(0, msg.errorCode, false)
    buffers.push(new Uint8Array(errorBuffer))
  }

  // Write payload
  buffers.push(msg.payload)

  // Merge all buffers
  const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0

  for (const buf of buffers) {
    result.set(buf, offset)
    offset += buf.length
  }

  return result
}

/**
 * Message deserialization
 */
export function unmarshalMessage(data: Uint8Array): Message {
  if (data.length < 3) {
    throw new Error(`data too short: expected at least 3 bytes, got ${data.length}`)
  }

  let offset = 0

  // Read base header
  const versionAndHeaderSize = data[offset++]
  const typeAndFlag = data[offset++]
  const serializationAndCompression = data[offset++]

  const msg: Message = {
    version: (versionAndHeaderSize >> 4) as VersionBits,
    headerSize: (versionAndHeaderSize & 0b00001111) as HeaderSizeBits,
    type: (typeAndFlag >> 4) as MsgType,
    flag: (typeAndFlag & 0b00001111) as MsgTypeFlagBits,
    serialization: (serializationAndCompression >> 4) as SerializationBits,
    compression: (serializationAndCompression & 0b00001111) as CompressionBits,
    payload: new Uint8Array(0),
  }

  // Skip remaining header bytes
  offset = 4 * msg.headerSize

  // Read sequence if needed
  if (
    (msg.type === MsgType.AudioOnlyClient ||
      msg.type === MsgType.AudioOnlyServer ||
      msg.type === MsgType.FrontEndResultServer ||
      msg.type === MsgType.FullClientRequest ||
      msg.type === MsgType.FullServerResponse) &&
    (msg.flag === MsgTypeFlagBits.PositiveSeq || msg.flag === MsgTypeFlagBits.NegativeSeq)
  ) {
    const seqView = new DataView(data.buffer, data.byteOffset + offset, 4)
    msg.sequence = seqView.getInt32(0, false)
    offset += 4
  }

  // Read error code for error messages
  if (msg.type === MsgType.Error) {
    const errorView = new DataView(data.buffer, data.byteOffset + offset, 4)
    msg.errorCode = errorView.getInt32(0, false)
    offset += 4
  }

  // Read event and session ID
  if (msg.flag === MsgTypeFlagBits.WithEvent) {
    const eventView = new DataView(data.buffer, data.byteOffset + offset, 4)
    msg.event = eventView.getInt32(0, false) as EventType
    offset += 4

    // Read session ID for non-connection events
    if (
      msg.event !== EventType.StartConnection &&
      msg.event !== EventType.FinishConnection &&
      msg.event !== EventType.ConnectionStarted &&
      msg.event !== EventType.ConnectionFailed
    ) {
      const sessionIdLenView = new DataView(data.buffer, data.byteOffset + offset, 4)
      const sessionIdLen = sessionIdLenView.getUint32(0, false)
      offset += 4

      if (sessionIdLen > 0) {
        const sessionIdBytes = data.slice(offset, offset + sessionIdLen)
        msg.sessionId = Buffer.from(sessionIdBytes).toString('utf8')
        offset += sessionIdLen
      }

      // Read connect ID
      const connectIdLenView = new DataView(data.buffer, data.byteOffset + offset, 4)
      const connectIdLen = connectIdLenView.getUint32(0, false)
      offset += 4

      if (connectIdLen > 0) {
        const connectIdBytes = data.slice(offset, offset + connectIdLen)
        msg.connectId = Buffer.from(connectIdBytes).toString('utf8')
        offset += connectIdLen
      }
    }
  }

  // Read payload
  msg.payload = data.slice(offset)

  return msg
}

/**
 * WebSocket message receiving
 */
export async function receiveMessage(ws: WebSocket): Promise<Message> {
  return new Promise((resolve, reject) => {
    const messageHandler = (data: WebSocket.Data) => {
      try {
        const buffer = data instanceof ArrayBuffer ? new Uint8Array(data) : data
        const msg = unmarshalMessage(buffer as Uint8Array)
        ws.removeListener('message', messageHandler)
        ws.removeListener('error', errorHandler)
        resolve(msg)
      } catch (error) {
        ws.removeListener('message', messageHandler)
        ws.removeListener('error', errorHandler)
        reject(error)
      }
    }

    const errorHandler = (error: Error) => {
      ws.removeListener('message', messageHandler)
      ws.removeListener('error', errorHandler)
      reject(error)
    }

    ws.once('message', messageHandler)
    ws.once('error', errorHandler)
  })
}

/**
 * Send FullClientRequest
 */
export async function sendFullClientRequest(
  ws: WebSocket,
  payload: Uint8Array
): Promise<void> {
  const msg = createMessage(MsgType.FullClientRequest, MsgTypeFlagBits.NoSeq)
  msg.payload = payload
  const data = marshalMessage(msg)
  return new Promise((resolve, reject) => {
    ws.send(data, (error?: Error) => {
      if (error) reject(error)
      else resolve()
    })
  })
}

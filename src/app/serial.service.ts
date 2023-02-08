///<reference types="chrome"/>
//'use strict';
import { Injectable, NgZone } from '@angular/core';
import { EventsService } from './events.service';
import { GlobalsService } from './globals.service';
import { UtilsService } from './utils.service';
import * as gIF from './gIF';
import * as gConst from './gConst';

@Injectable({
    providedIn: 'root',
})
export class SerialService {

    public searchPortFlag = false;
    validPortFlag = false;
    portOpenFlag = false;
    private portIdx = 0;

    private testPortTMO = null;

    private crc = 0;
    private calcCRC = 0;
    private msgIdx = 0;
    private isEsc = false;
    private rxBuf = new ArrayBuffer(256);
    private rxMsg = new Uint8Array(this.rxBuf);
    private rxState = gIF.eRxState.E_STATE_RX_WAIT_START;

    private msgType = 0;
    private msgLen = 0;

    private seqNum = 0;

    private comFlag = false;
    private comPorts = [];
    private connID = -1;

    //validPortTMO = null;

    trash: any;

    constructor(private events: EventsService,
                private globals: GlobalsService,
                private utils: UtilsService,
                private ngZone: NgZone) {
        chrome.serial.onReceive.addListener((info)=>{
            if(info.connectionId === this.connID){
                this.slOnData(info.data);
            }
        });
        chrome.serial.onReceiveError.addListener((info: any)=>{
                this.rcvErrCB(info);
        });
        setTimeout(()=>{
            this.checkCom();
        }, 15000);
        setTimeout(()=>{
            this.listComPorts();
        }, 1000);
    }

    /***********************************************************************************************
     * fn          checkCom
     *
     * brief
     *
     */
    checkCom() {
        if(this.comFlag == false) {
            if(this.validPortFlag === true){
                setTimeout(()=>{
                    this.closeComPort();
                }, 0);
            }
        }
        this.comFlag = false;
        setTimeout(()=>{
            this.checkCom();
        }, 30000);
    }

    /***********************************************************************************************
     * fn          closeComPort
     *
     * brief
     *
     */
    closeComPort() {
        if(this.connID > -1){
            this.utils.sendMsg('close port', 'red');
            this.events.publish('closePort', 'close');
            chrome.serial.disconnect(
                this.connID,
                (result)=>{
                    this.connID = -1;
                    this.portOpenFlag = false;
                    this.validPortFlag = false;
                    setTimeout(() => {
                        this.findComPort();
                    }, 200);
                }
            );
        }
    }

    /***********************************************************************************************
     * fn          listComPorts
     *
     * brief
     *
     */
    listComPorts() {
        chrome.serial.getDevices((ports)=>{
            this.comPorts = [];
            for(let i = 0; i < ports.length; i++){
                if(ports[i].vendorId === 0x0403){      // FTDI
                    if(ports[i].productId === 0x6015){ // FX230
                        this.comPorts.push(ports[i]);
                    }
                }
            }
            if(this.comPorts.length) {
                this.searchPortFlag = true;
                this.portIdx = 0;
                setTimeout(()=>{
                    this.findComPort();
                }, 200);
            }
            else {
                this.searchPortFlag = false;
                setTimeout(()=>{
                    this.listComPorts();
                }, 2000);
                this.utils.sendMsg('no com ports', 'red', 7);
            }
        });
    }

    /***********************************************************************************************
     * fn          findComPort
     *
     * brief
     *
     */
    private findComPort() {

        if(this.searchPortFlag === false){
            setTimeout(()=>{
                this.listComPorts();
            }, 1000);
            return;
        }
        let portPath = this.comPorts[this.portIdx].path;
        this.utils.sendMsg(`testing: ${portPath}`, 'blue');
        let connOpts = {
            bitrate: 115200
        };
        chrome.serial.connect(
            portPath,
            connOpts,
            (connInfo)=>{
                if(connInfo){
                    this.connID = connInfo.connectionId;
                    this.portOpenFlag = true;
                    this.testPortTMO = setTimeout(()=>{
                        this.closeComPort();
                    }, 2000);
                    this.testPortReq();
                }
                else {
                    this.utils.sendMsg(`err: ${chrome.runtime.lastError.message}`, 'red');
                    setTimeout(() => {
                        this.findComPort();
                    }, 200);
                }
            }
        );
        this.portIdx++;
        if(this.portIdx >= this.comPorts.length) {
            this.searchPortFlag = false;
        }
    }

    /***********************************************************************************************
     * fn          slOnData
     *
     * brief
     *
     */
    private slOnData(msg) {

        let pkt = new Uint8Array(msg);

        for(let i = 0; i < pkt.length; i++) {
            let rxByte = pkt[i];
            switch(rxByte) {
                case gConst.SL_START_CHAR: {
                    this.msgIdx = 0;
                    this.isEsc = false;
                    this.rxState = gIF.eRxState.E_STATE_RX_WAIT_TYPELSB;
                    break;
                }
                case gConst.SL_ESC_CHAR: {
                    this.isEsc = true;
                    break;
                }
                case gConst.SL_END_CHAR: {
                    if(this.crc == this.calcCRC) {
                        let slMsg: gIF.slMsg_t = {
                            type: this.msgType,
                            data: Array.from(this.rxMsg).slice(0, this.msgIdx),
                        };
                        setTimeout(()=>{
                            this.processMsg(slMsg);
                        }, 0);
                    }
                    this.rxState = gIF.eRxState.E_STATE_RX_WAIT_START;
                    break;
                }
                default: {
                    if(this.isEsc == true) {
                        rxByte ^= 0x10;
                        this.isEsc = false;
                    }
                    switch(this.rxState) {
                        case gIF.eRxState.E_STATE_RX_WAIT_START: {
                            // ---
                            break;
                        }
                        case gIF.eRxState.E_STATE_RX_WAIT_TYPELSB: {
                            this.msgType = rxByte;
                            this.rxState = gIF.eRxState.E_STATE_RX_WAIT_TYPEMSB;
                            this.calcCRC = rxByte;
                            break;
                        }
                        case gIF.eRxState.E_STATE_RX_WAIT_TYPEMSB: {
                            this.msgType += rxByte << 8;
                            this.rxState = gIF.eRxState.E_STATE_RX_WAIT_LENLSB;
                            this.calcCRC ^= rxByte;
                            break;
                        }
                        case gIF.eRxState.E_STATE_RX_WAIT_LENLSB: {
                            this.msgLen = rxByte;
                            this.rxState = gIF.eRxState.E_STATE_RX_WAIT_LENMSB;
                            this.calcCRC ^= rxByte;
                            break;
                        }
                        case gIF.eRxState.E_STATE_RX_WAIT_LENMSB: {
                            this.msgLen += rxByte << 8;
                            this.rxState = gIF.eRxState.E_STATE_RX_WAIT_CRC;
                            this.calcCRC ^= rxByte;
                            break;
                        }
                        case gIF.eRxState.E_STATE_RX_WAIT_CRC: {
                            this.crc = rxByte;
                            this.rxState = gIF.eRxState.E_STATE_RX_WAIT_DATA;
                            break;
                        }
                        case gIF.eRxState.E_STATE_RX_WAIT_DATA: {
                            if(this.msgIdx < this.msgLen) {
                                this.rxMsg[this.msgIdx++] = rxByte;
                                this.calcCRC ^= rxByte;
                            }
                            break;
                        }
                    }
                }
            }
        }
    }

    /***********************************************************************************************
     * fn          processMsg
     *
     * brief
     *
     */
    private processMsg(msg: gIF.slMsg_t) {

        let msgData = new Uint8Array(msg.data);
        switch(msg.type) {
            case gConst.SL_MSG_TESTPORT: {
                let slMsg = new DataView(msgData.buffer);
                let idNum = 0;
                let msgIdx = 0;
                let msgSeqNum = slMsg.getUint8(msgIdx++);
                if(msgSeqNum == this.seqNum) {
                    idNum = slMsg.getUint32(msgIdx, gConst.LE);
                    msgIdx += 4;
                    if(idNum === 0x67190110) {
                        clearTimeout(this.testPortTMO);
                        this.validPortFlag = true;
                        this.searchPortFlag = false;
                        setTimeout(()=>{
                            this.readPartNum();
                        }, 1000);
                        this.utils.sendMsg('port valid', 'green');
                    }
                }
                break;
            }
            case gConst.SL_MSG_USB_CMD: {
                let slMsg = new DataView(msgData.buffer);
                let msgIdx = 0;
                let msgSeqNum = slMsg.getUint8(msgIdx++);
                if(msgSeqNum == this.seqNum) {
                    let cmdID = slMsg.getUint8(msgIdx++);
                    switch(cmdID) {
                        case gConst.USB_CMD_KEEP_AWAKE: {
                            let status = slMsg.getUint8(msgIdx++);
                            if(status == gConst.USB_CMD_STATUS_OK) {
                                console.log('keep awake ok');
                            }
                            if(status == gConst.USB_CMD_STATUS_FAIL) {
                                console.log('keep awake fail');
                            }
                            break;
                        }
                        case gConst.USB_CMD_RD_KEYS: {
                            let status = slMsg.getUint8(msgIdx++);
                            if(status == gConst.USB_CMD_STATUS_OK) {
                                let rdKeysRsp = {} as gIF.rdKeys_t;
                                rdKeysRsp.status = gConst.USB_CMD_STATUS_OK;
                                let i = 0;
                                let chrCode = 0;
                                let nwkKey = '';
                                for(i = 0; i < 16; i++) {
                                    chrCode = slMsg.getUint8(msgIdx++);
                                    if(chrCode != 0) {
                                        nwkKey += String.fromCharCode(chrCode);
                                    }
                                }
                                rdKeysRsp.nwkKey = nwkKey;
                                rdKeysRsp.panId = slMsg.getUint16(msgIdx, gConst.LE);
                                this.events.publish('rdKeysRsp', rdKeysRsp);
                            }
                            else {
                                this.utils.sendMsg('read keys fail', 'red');
                            }
                            break;
                        }
                        case gConst.USB_CMD_RD_NODE_DATA_0: {
                            let dataLen = slMsg.getUint8(msgIdx++);
                            let nodeData = new Uint8Array(dataLen);
                            for(let i = 0; i < dataLen; i++) {
                                nodeData[i] = slMsg.getUint8(msgIdx++);
                            }
                            this.events.publish('rdNodeDataRsp', nodeData);
                            break;
                        }
                        case gConst.USB_CMD_READ_PART_NUM: {
                            let partNum = slMsg.getUint32(msgIdx, this.globals.LE);
                            msgIdx += 4;
                            this.events.publish('readPartNumRsp', partNum);
                            this.utils.sendMsg(`comm ok`, 'blue', 7);
                            setTimeout(()=>{
                                this.readPartNum();
                            }, 5000);
                            this.comFlag = true;
                            break;
                        }
                        default: {
                            // ---
                        }
                    }
                }
                break;
            }
            case gConst.SL_MSG_LOG: {
                let log_msg = String.fromCharCode.apply(null, msgData);
                this.utils.sendMsg(log_msg);
                break;
            }
        }
    }

    /***********************************************************************************************
     * fn          testPortReq
     *
     * brief
     *
     */
    private testPortReq() {

        let pktBuf = new ArrayBuffer(64);
        let pktData = new Uint8Array(pktBuf);
        let pktView = new DataView(pktBuf);
        let slMsgBuf = new Uint8Array(128);
        let i: number;
        let msgIdx: number;

        this.seqNum = ++this.seqNum % 256;
        msgIdx = 0;
        pktView.setUint16(msgIdx, gConst.SL_MSG_TESTPORT, gConst.LE);
        msgIdx += 2;
        msgIdx += 2 + 1; // len + crc
        // cmd data
        pktView.setUint8(msgIdx++, this.seqNum);
        pktView.setUint32(msgIdx, 0x67190110, gConst.LE);
        msgIdx += 4;
        let msgLen = msgIdx;
        let dataLen = msgLen - gConst.HEAD_LEN;
        pktView.setUint16(gConst.LEN_IDX, dataLen, gConst.LE);
        let crc = 0;
        for(i = 0; i < msgLen; i++) {
            crc ^= pktData[i];
        }
        pktView.setUint8(gConst.CRC_IDX, crc);

        this.serialSend(pktData, msgLen);
    }

    /***********************************************************************************************
     * fn          softwareRstReq
     *
     * brief
     *
     */
    public softwareRstReq() {
        this.usbCmd(gConst.USB_CMD_SOFTWARE_RESET, null);
    }

    /***********************************************************************************************
     * fn          factoryRstReq
     *
     * brief
     *
     */
    public factoryRstReq() {
        this.usbCmd(gConst.USB_CMD_FACTORY_RESET, null);
    }

    /***********************************************************************************************
     * fn          rdKeys
     *
     * brief
     *
     */
    public rdKeys() {
        this.usbCmd(gConst.USB_CMD_RD_KEYS, null);
    }

    /***********************************************************************************************
     * fn          wrKeys
     *
     * brief
     *
     */
    public wrKeys(nwkKey: string, panId: number) {
        let param = {
            nwkKey: nwkKey,
            panId: panId
        };
        this.usbCmd(gConst.USB_CMD_WR_KEYS, param);
    }

    /***********************************************************************************************
     * fn          rdNodeData_0
     *
     * brief
     *
     */
    public rdNodeData_0() {
        this.usbCmd(gConst.USB_CMD_RD_NODE_DATA_0, null);
    }

    /***********************************************************************************************
     * fn          wrNodeData_0
     *
     * brief
     *
     */
    public wrNodeData_0(arrBuf: ArrayBuffer) {
        let param = {
            buf: arrBuf,
        };
        this.usbCmd(gConst.USB_CMD_WR_NODE_DATA_0, param);
    }

    /***********************************************************************************************
     * fn          readPartNum
     *
     * brief
     *
     */
    public readPartNum() {
        this.usbCmd(gConst.USB_CMD_READ_PART_NUM, null);
    }

    /***********************************************************************************************
     * fn          usbCmd
     *
     * brief
     *
     */
    public usbCmd(cmdID: number, param: any) {

        if(this.validPortFlag === false) {
            return;
        }
        let pktBuf = new ArrayBuffer(1024);
        let pktData = new Uint8Array(pktBuf);
        let pktView = new DataView(pktBuf);
        let slMsgBuf = new Uint8Array(2048);
        let i: number;
        let msgIdx: number;

        this.seqNum = ++this.seqNum % 256;
        msgIdx = 0;
        pktView.setUint16(msgIdx, gConst.SL_MSG_USB_CMD, gConst.LE);
        msgIdx += 2;
        msgIdx += 2 + 1; // len + crc
        // cmd data
        pktView.setUint8(msgIdx++, this.seqNum);
        pktView.setUint8(msgIdx++, cmdID);
        switch(cmdID) {
            case gConst.USB_CMD_WR_KEYS: {
                for(i = 0; i < 16; i++) {
                    let chrCode = param.nwkKey.charCodeAt(i);
                    if(chrCode) {
                        pktView.setUint8(msgIdx++, chrCode);
                    }
                    else {
                        pktView.setUint8(msgIdx++, 0);
                    }
                }
                pktView.setUint16(msgIdx, param.panId, gConst.LE);
                msgIdx += 2;
                break;
            }
            case gConst.USB_CMD_WR_NODE_DATA_0: {
                let data = new Uint8Array(param.buf);
                for(i = 0; i < param.buf.byteLength; i++) {
                    pktView.setUint8(msgIdx++, data[i]);
                }
                break;
            }
            default: {
                // ---
            }
        }
        let msgLen = msgIdx;
        let dataLen = msgLen - gConst.HEAD_LEN;
        pktView.setUint16(gConst.LEN_IDX, dataLen, gConst.LE);
        let crc = 0;
        for(i = 0; i < msgLen; i++) {
            crc ^= pktData[i];
        }
        pktView.setUint8(gConst.CRC_IDX, crc);

        this.serialSend(pktData, msgLen);
    }

    /***********************************************************************************************
     * fn          serialSend
     *
     * brief
     *
     */
    serialSend(pktData: Uint8Array, msgLen: number) {

        let slMsgBuf = new Uint8Array(128);
        let msgIdx = 0;

        slMsgBuf[msgIdx++] = gConst.SL_START_CHAR;
        for(let i = 0; i < msgLen; i++) {
            if(pktData[i] < 0x10) {
                pktData[i] ^= 0x10;
                slMsgBuf[msgIdx++] = gConst.SL_ESC_CHAR;
            }
            slMsgBuf[msgIdx++] = pktData[i];
        }
        slMsgBuf[msgIdx++] = gConst.SL_END_CHAR;

        let slMsgLen = msgIdx;
        let slMsg = slMsgBuf.slice(0, slMsgLen);
        chrome.serial.send(
            this.connID,
            slMsg.buffer,
            (sendInfo: any)=>{
                if(sendInfo.error){
                    switch(sendInfo.error){
                        case 'disconnected':
                        case 'system_error': {
                            setTimeout(() => {
                                this.closeComPort();
                            }, 100);
                            break;
                        }
                        case 'pending': {
                            break;
                        }
                        case 'timeout': {
                            break;
                        }
                    }
                    this.utils.sendMsg(`send err: ${sendInfo.error}`, 'red');
                }
            }
        );
    }

    /***********************************************************************************************
     * fn          rcvErrCB
     *
     * brief
     *
     */
    rcvErrCB(info: any) {
        if(info.connectionId === this.connID){
            this.utils.sendMsg(`port err: ${info.error}`, 'red');
            switch(info.error){
                case 'disconnected':
                case 'device_lost':
                case 'system_error': {
                    setTimeout(() => {
                        this.closeComPort();
                    }, 100);
                    break;
                }
                case 'timeout':
                case 'break':
                case 'frame_error':
                case 'overrun':
                case 'buffer_overflow':
                case 'parity_error': {
                    // ---
                    break;
                }
            }
        }
    }
}

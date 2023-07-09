///<reference types="chrome"/>
//'use strict';
import { Injectable, NgZone } from '@angular/core';
import { EventsService } from './events.service';
import { GlobalsService } from './globals.service';
import { UtilsService } from './utils.service';
import * as gIF from './gIF';
import * as gConst from './gConst';

interface sl_msg {
    type: number;
    nodeBuf: any;
}

@Injectable({
    providedIn: 'root',
})
export class SerialService {

    public searchPortFlag = false;
    validPortFlag = false;
    portOpenFlag = false;
    private portIdx = 0;
    portPath = '';

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

    //trash: any;

    rxNodeBuf = window.nw.Buffer.alloc(1024);
    txNodeBuf = window.nw.Buffer.alloc(1024);
    rwBuf = new gIF.rwBuf_t();
    //msgNodeBuff: any;

    slMsg = {} as sl_msg;

    constructor(private events: EventsService,
                private globals: GlobalsService,
                private utils: UtilsService,
                private ngZone: NgZone) {
        this.rwBuf.wrBuf = this.txNodeBuf;
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
        setInterval(()=>{
            this.readPartNum();
        }, 5000)
    }

    /***********************************************************************************************
     * fn          checkCom
     *
     * brief
     *
     */
    async checkCom() {
        if(this.comFlag == false) {
            await this.closeComPort();
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
    async closeComPort() {
        if(this.connID > -1){
            this.utils.sendMsg('close port', 'red');
            this.events.publish('closePort', 'close');

            const result = await this.closePortAsync(this.connID);
            if(result){
                this.connID = -1;
                this.portOpenFlag = false;
                this.validPortFlag = false;
                setTimeout(() => {
                    this.findComPort();
                }, 200);
            }
        }
    }

    /***********************************************************************************************
     * fn          closePortAsync
     *
     * brief
     *
     */
    closePortAsync(id: number) {
        return new Promise((resolve)=>{
            chrome.serial.disconnect(id, (result)=>{
                resolve(result);
            });
        });
    }

    /***********************************************************************************************
     * fn          listComPorts
     *
     * brief
     *
     */
    listComPorts() {
        chrome.serial.getDevices((ports)=>{
            /*
            for(let i = 0; i < ports.length; i++){
                if(ports[i].vendorId){
                    if(ports[i].productId){
                        this.comPorts.push(ports[i]);
                    }
                }
            }
            */
            this.comPorts = ports;
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
    async findComPort() {

        if(this.searchPortFlag === false){
            setTimeout(()=>{
                this.listComPorts();
            }, 1000);
            return;
        }
        this.portPath = this.comPorts[this.portIdx].path;
        this.utils.sendMsg(`testing: ${this.portPath}`, 'blue');
        let connOpts = {
            bitrate: 115200
        };
        const connInfo: any = await this.serialConnectAsync(connOpts);
        if(connInfo){
            this.connID = connInfo.connectionId;
            this.portOpenFlag = true;
            this.testPortTMO = setTimeout(()=>{
                this.closeComPort();
            }, 1000);
            setTimeout(() => {
                this.testPortReq();
            }, 10);
        }
        else {
            this.utils.sendMsg(`err: ${chrome.runtime.lastError.message}`, 'red');
            setTimeout(() => {
                this.findComPort();
            }, 10);
        }
        this.portIdx++;
        if(this.portIdx >= this.comPorts.length) {
            this.searchPortFlag = false;
        }
    }

    /***********************************************************************************************
     * fn          serialConnectAsync
     *
     * brief
     *
     */
    serialConnectAsync(connOpt) {
        return new Promise((resolve)=>{
            chrome.serial.connect(this.portPath, connOpt, (connInfo)=>{
                resolve(connInfo);
            });
        });
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
                        this.slMsg.type = this.msgType;
                        this.slMsg.nodeBuf = this.rxNodeBuf.subarray(0, this.msgLen);
                        setTimeout(()=>{
                            this.processMsg(this.slMsg);
                        }, 1);
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
                                this.rxNodeBuf[this.msgIdx++] = rxByte;
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
    private processMsg(slMsg: sl_msg) {

        this.rwBuf.rdBuf = slMsg.nodeBuf;
        this.rwBuf.rdIdx = 0;

        switch(slMsg.type) {
            case gConst.SL_MSG_TESTPORT: {
                let idNum = 0;
                let msgSeqNum = this.rwBuf.read_uint8();
                if(msgSeqNum == this.seqNum) {
                    idNum = this.rwBuf.read_uint32_LE();
                    if(idNum === 0x67190110) {
                        clearTimeout(this.testPortTMO);
                        this.validPortFlag = true;
                        this.searchPortFlag = false;
                        setTimeout(()=>{
                            this.readPartNum();
                        }, 300);
                        this.utils.sendMsg('port valid', 'green');
                    }
                }
                break;
            }
            case gConst.SL_MSG_USB_CMD: {
                let msgSeqNum = this.rwBuf.read_uint8();
                if(msgSeqNum == this.seqNum) {
                    let cmdID = this.rwBuf.read_uint8();
                    switch(cmdID) {
                        case gConst.USB_CMD_KEEP_AWAKE: {
                            let status = this.rwBuf.read_uint8();
                            if(status == gConst.USB_CMD_STATUS_OK) {
                                console.log('keep awake ok');
                            }
                            if(status == gConst.USB_CMD_STATUS_FAIL) {
                                console.log('keep awake fail');
                            }
                            break;
                        }
                        case gConst.USB_CMD_RD_KEYS: {
                            let status = this.rwBuf.read_uint8();
                            if(status == gConst.USB_CMD_STATUS_OK) {
                                let rdKeysRsp = {} as gIF.rdKeys_t;
                                rdKeysRsp.status = gConst.USB_CMD_STATUS_OK;
                                let i = 0;
                                let chrCode = 0;
                                let nwkKey = '';
                                for(i = 0; i < 16; i++) {
                                    chrCode = this.rwBuf.read_uint8();
                                    if(chrCode != 0) {
                                        nwkKey += String.fromCharCode(chrCode);
                                    }
                                }
                                rdKeysRsp.nwkKey = nwkKey;
                                rdKeysRsp.panId = this.rwBuf.read_uint16_LE();
                                rdKeysRsp.nwkCh = this.rwBuf.read_uint8();
                                this.events.publish('rdKeysRsp', rdKeysRsp);
                            }
                            else {
                                this.utils.sendMsg('read keys fail', 'red');
                            }
                            break;
                        }
                        case gConst.USB_CMD_RD_NODE_DATA_0: {
                            let dataLen = this.rwBuf.read_uint8();
                            const rspNodeBuf = window.nw.Buffer.alloc(dataLen);
                            for(let i = 0; i < dataLen; i++) {
                                rspNodeBuf[i] = this.rwBuf.read_uint8();
                            }
                            this.events.publish('rdNodeDataRsp', rspNodeBuf);
                            this.utils.sendMsg(`node data rsp`, 'blue');
                            break;
                        }
                        case gConst.USB_CMD_READ_PART_NUM: {
                            let partNum = this.rwBuf.read_uint32_LE();
                            this.events.publish('readPartNumRsp', partNum);
                            this.utils.sendMsg(`comm ok`, 'blue', 7);
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
                let log_msg = '';
                let chrCode: number
                for(let i = 0; i < slMsg.nodeBuf.length; i++) {
                    chrCode = this.rwBuf.read_uint8();
                    if(chrCode != 0) {
                        log_msg += String.fromCharCode(chrCode);
                    }
                }
                this.utils.sendMsg(log_msg, 'orange');
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
    async testPortReq() {

        this.seqNum = ++this.seqNum % 256;
        this.rwBuf.wrIdx = 0;

        this.rwBuf.write_uint16_LE(gConst.SL_MSG_TESTPORT);
        this.rwBuf.write_uint16_LE(0); // len
        this.rwBuf.write_uint8(0);     // CRC
        // cmd data
        this.rwBuf.write_uint8(this.seqNum);
        this.rwBuf.write_uint32_LE(0x67190110);

        let msgLen = this.rwBuf.wrIdx;
        let dataLen = msgLen - gConst.HEAD_LEN;
        this.rwBuf.modify_uint16_LE(dataLen, gConst.LEN_IDX);
        let crc = 0;
        for(let i = 0; i < msgLen; i++) {
            crc ^= this.txNodeBuf[i];
        }
        this.rwBuf.modify_uint8(crc, gConst.CRC_IDX);

        await this.serialSend(msgLen);
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
    public wrKeys(nwkKey: string, panId: number, nwkCh: number) {
        let param = {
            nwkKey: nwkKey,
            panId: panId,
            nwkCh: nwkCh
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
    async readPartNum() {
        await this.usbCmd(gConst.USB_CMD_READ_PART_NUM, null);
    }

    /***********************************************************************************************
     * fn          usbCmd
     *
     * brief
     *
     */
    async usbCmd(cmdID: number, param: any) {

        if(this.validPortFlag === false) {
            return;
        }

        this.seqNum = ++this.seqNum % 256;
        this.rwBuf.wrIdx = 0;

        this.rwBuf.write_uint16_LE(gConst.SL_MSG_USB_CMD);
        this.rwBuf.write_uint16_LE(0); // len
        this.rwBuf.write_uint8(0);     // CRC
        // cmd data
        this.rwBuf.write_uint8(this.seqNum);
        this.rwBuf.write_uint8(cmdID);
        switch(cmdID) {
            case gConst.USB_CMD_WR_KEYS: {
                for(let i = 0; i < 16; i++) {
                    const chrCode = param.nwkKey.charCodeAt(i);
                    if(chrCode) {
                        this.rwBuf.write_uint8(chrCode);
                    }
                    else {
                        this.rwBuf.write_uint8(0);
                    }
                }
                this.rwBuf.write_uint16_LE(param.panId);
                this.rwBuf.write_uint8(param.nwkCh);
                break;
            }
            case gConst.USB_CMD_WR_NODE_DATA_0: {
                let data = new Uint8Array(param.buf);
                for(let i = 0; i < param.buf.byteLength; i++) {
                    this.rwBuf.write_uint8(data[i]);
                }
                break;
            }
            default: {
                // ---
            }
        }
        const msgLen = this.rwBuf.wrIdx;
        const dataLen = msgLen - gConst.HEAD_LEN;
        this.rwBuf.modify_uint16_LE(dataLen, gConst.LEN_IDX);
        let crc = 0;
        for(let i = 0; i < msgLen; i++) {
            crc ^= this.txNodeBuf[i];
        }
        this.rwBuf.modify_uint8(crc, gConst.CRC_IDX);

        await this.serialSend(msgLen);
    }

    /***********************************************************************************************
     * fn          serialSend
     *
     * brief
     *
     */
    async serialSend(msgLen: number) {

        let slMsgBuf = new Uint8Array(128);
        let msgIdx = 0;

        slMsgBuf[msgIdx++] = gConst.SL_START_CHAR;
        for(let i = 0; i < msgLen; i++) {
            if(this.txNodeBuf[i] < 0x10) {
                this.txNodeBuf[i] ^= 0x10;
                slMsgBuf[msgIdx++] = gConst.SL_ESC_CHAR;
            }
            slMsgBuf[msgIdx++] = this.txNodeBuf[i];
        }
        slMsgBuf[msgIdx++] = gConst.SL_END_CHAR;

        let slMsgLen = msgIdx;
        let slMsg = slMsgBuf.slice(0, slMsgLen);

        const sendInfo: any = await this.serialSendAsync(slMsg);
        if(sendInfo.error){
            this.utils.sendMsg(`send err: ${sendInfo.error}`, 'red');
        }
        /*
        chrome.serial.send(
            this.connID,
            slMsg.buffer,
            (sendInfo: any)=>{
                if(sendInfo.error){
                    this.utils.sendMsg(`send err: ${sendInfo.error}`, 'red');
                }
            }
        );
        */
    }

    /***********************************************************************************************
     * fn          serialSendAsync
     *
     * brief
     *
     */
    serialSendAsync(slMsg: any) {
        return new Promise((resolve)=>{
            chrome.serial.send(this.connID, slMsg.buffer, (sendInfo: any)=>{
                resolve(sendInfo);
            });
        });
    }

    /***********************************************************************************************
     * fn          rcvErrCB
     *
     * brief
     *
     */
    async rcvErrCB(info: any) {
        if(info.connectionId === this.connID){
            switch(info.error){
                case 'disconnected': {
                    this.utils.sendMsg(`${this.portPath} disconnected`);
                    setTimeout(()=>{
                        this.closeComPort();
                    }, 10);
                    break;
                }
                case 'device_lost': {
                    this.utils.sendMsg(`${this.portPath} lost`, 'red');
                    setTimeout(()=>{
                        this.closeComPort();
                    }, 10);
                    break;
                }
                case 'system_error': {
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

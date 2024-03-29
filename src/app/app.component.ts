import { Component, NgZone, OnDestroy, OnInit, ViewChild, ComponentFactoryResolver, ViewContainerRef } from '@angular/core';
import { GlobalsService } from './globals.service';
import { EventsService } from './events.service';
import { SerialService } from './serial.service';
import { Validators, FormGroup, FormControl } from '@angular/forms';

import { HTU21D_005_Component } from './htu21d-005/htu21d-005.component';
import { SHT40_018_Component } from './sht40-018/sht40-018.component';
import { SH_006_Component } from './sh-006/sh-006.component';
//import { BME280_007_Component } from './bme280-007/bme280-007.component';
import { SSR_009_Component } from './ssr-009/ssr-009.component';
import { Actuator_010_Component } from './actuator-010/actuator-010.component';
import { DBL_SW_008_Component } from './dbl-sw-008/dbl-sw-008.component';
import { TGL_SW_011_Component } from './tgl-sw-011/tgl-sw-011';
import { RKR_SW_012_Component } from './rkr-sw-012/rkr-sw-012';
import { ZB_Bridge_Component } from './zb-bridge/zb-bridge.component';
import { Esp_Link_Component } from './esp-link/esp-link.component';
import { AQ_015_Component } from './aq-015/aq-015.component';
import { SI7021_027_Component } from './si7021-027/SI7021-027.component';
import { PB_SW_023_Component } from './pb-sw-023/pb-sw-023';
import { Subscription } from 'rxjs';

import * as gIF from './gIF';
import * as gConst from './gConst';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit, OnDestroy {

    @ViewChild('dynamic', {read: ViewContainerRef}) viewRef: ViewContainerRef;

    minId = 1;
    maxId = 0xFFFE;
    minCh = 11;
    maxCh = 26;

    nwkKeyFormCtrl: FormControl;
    panIdFormCtrl: FormControl;
    nwkChFormCtrl: FormControl;
    subscription = new Subscription();

    logs: gIF.msgLogs_t[] = [];
    scrollFlag = true;

    partNum = 0;
    prevPartNum = -1;
    startFlag = true;

    espLinkFlag = false;

    constructor(public serial: SerialService,
                public globals: GlobalsService,
                private events: EventsService,
                private ngZone: NgZone) {
        // ---
    }

    /***********************************************************************************************
     * fn          ngOnDestroy
     *
     * brief
     *
     */
    ngOnDestroy() {
        this.serial.closeComPort();
        this.subscription.unsubscribe();
    }

    /***********************************************************************************************
     * fn          ngOnInit
     *
     * brief
     *
     */
    ngOnInit() {

        this.nwkKeyFormCtrl = new FormControl(
            'link-key-1234567',
            [
                Validators.required,
                Validators.minLength(16),
                Validators.maxLength(16),
            ]
        )
        this.nwkKeyFormCtrl.markAsTouched();
        /*
        const nwkKeySubscription = this.nwkKeyFormCtrl.valueChanges.subscribe((key)=>{
            // ---
        });
        this.subscription.add(nwkKeySubscription);
        */
        this.panIdFormCtrl = new FormControl(
            this.minId,
            [
                Validators.required,
                Validators.min(this.minId),
                Validators.max(this.maxId),
            ]
        );
        this.panIdFormCtrl.markAsTouched();
        /*
        const panIdSubscription = this.panIdFormCtrl.valueChanges.subscribe((newId)=>{
            // ---
        });
        this.subscription.add(panIdSubscription);
        */
        this.nwkChFormCtrl = new FormControl(
            this.minCh,
            [
                Validators.required,
                Validators.min(this.minCh),
                Validators.max(this.maxCh),
            ]
        );
        this.nwkChFormCtrl.markAsTouched();
        /*
        const panIdSubscription = this.panIdFormCtrl.valueChanges.subscribe((newId)=>{
            // ---
        });
        this.subscription.add(panIdSubscription);
        */

        this.events.subscribe('closePort', (msg)=>{
            if(msg == 'close'){
                this.prevPartNum = -1;
                this.startFlag = true;
            }
        });

        this.events.subscribe('rdKeysRsp', (msg)=>{
            this.rdKeysMsg(msg);
        });

        window.onbeforeunload = ()=>{
            this.ngOnDestroy();
        };

        this.events.subscribe('logMsg', (msg: gIF.msgLogs_t)=>{
            const last = this.logs.slice(-1)[0];
            if(this.logs.length && (last.id === 7) && (msg.id === 7)){
                this.ngZone.run(()=>{
                    this.logs[this.logs.length - 1] = msg;
                });
            }
            else {
                while(this.logs.length >= 20) {
                    this.logs.shift();
                }
                this.ngZone.run(()=>{
                    this.logs.push(msg);
                });
            }
            if(this.scrollFlag == true) {
                let logsDiv = document.getElementById('logList');
                logsDiv.scrollTop = logsDiv.scrollHeight;
            }
        });
        this.events.subscribe('readPartNumRsp', (msg: number)=>{
            this.partNum = msg;
            if(this.partNum != this.prevPartNum) {
                this.prevPartNum = this.partNum;
                if(this.partNum != this.globals.ESP_LINK){
                    this.espLinkFlag = false;
                }
                this.viewRef.clear();
                switch(this.partNum) {
                    case this.globals.ZB_BRIDGE: {
                        this.viewRef.createComponent(ZB_Bridge_Component);
                        break;
                    }
                    case this.globals.ESP_LINK: {
                        this.espLinkFlag = true;
                        this.viewRef.createComponent(Esp_Link_Component);
                        break;
                    }
                    case this.globals.HTU21D_005: {
                        this.viewRef.createComponent(HTU21D_005_Component);
                        break;
                    }
                    case this.globals.SHT40_018: {
                        this.viewRef.createComponent(SHT40_018_Component);
                        break;
                    }
                    case this.globals.SI7021_027: {
                        this.viewRef.createComponent(SI7021_027_Component);
                        break;
                    }
                    case this.globals.SH_006: {
                        this.viewRef.createComponent(SH_006_Component);
                        break;
                    }
                    case this.globals.DBL_SW_008: {
                        this.viewRef.createComponent(DBL_SW_008_Component);
                        break;
                    }
                    case this.globals.TGL_SW_011: {
                        this.viewRef.createComponent(TGL_SW_011_Component);
                        break;
                    }
                    case this.globals.RKR_SW_012: {
                        this.viewRef.createComponent(RKR_SW_012_Component);
                        break;
                    }
                    case this.globals.PB_SW_023: {
                        this.viewRef.createComponent(PB_SW_023_Component);
                        break;
                    }
                    case this.globals.ACTUATOR_010: {
                        this.viewRef.createComponent(Actuator_010_Component);
                        break;
                    }
                    case this.globals.SSR_009: {
                        this.viewRef.createComponent(SSR_009_Component);
                        break;
                    }
                    case this.globals.AQ_015: {
                        this.viewRef.createComponent(AQ_015_Component);
                        break;
                    }
                    default:
                        break;
                }
            }
            console.log(`part number: ${this.partNum}`);
            if(this.startFlag == true) {
                console.log('---***---');
                this.startFlag = false;
                if(!this.espLinkFlag){
                    setTimeout(()=>{
                        this.readKeys();
                    }, 300);
                }
                setTimeout(()=>{
                    this.serial.rdNodeData_0();
                }, 1000);
            }
        });
    }

    /***********************************************************************************************
     * fn          autoScroll
     *
     * brief
     *
     */
    autoScrollChange(scroll) {
        console.log(scroll);
        this.scrollFlag = scroll;
        if(scroll == true) {
            let logsDiv = document.getElementById('logList');
            logsDiv.scrollTop = logsDiv.scrollHeight;
        }
    }
    /***********************************************************************************************
     * fn          readKeys
     *
     * brief
     *
     */
    readKeys() {
        this.ngZone.run(()=>{
            this.nwkKeyFormCtrl.setValue('****************');
        });
        setTimeout(()=>{
            this.serial.rdKeys();
        }, 500);
    }
    /***********************************************************************************************
     * fn          rdKeysMsg
     *
     * brief
     *
     */
    rdKeysMsg(msg: gIF.rdKeys_t) {
        if(msg.status == gConst.USB_CMD_STATUS_OK) {
            console.log(`msg: ${JSON.stringify(msg)}`);
            this.ngZone.run(()=>{
                this.nwkKeyFormCtrl.setValue(msg.nwkKey);
                this.panIdFormCtrl.setValue(msg.panId);
                this.nwkChFormCtrl.setValue(msg.nwkCh);
            });
        }
    }

    /***********************************************************************************************
     * fn          nwkKeyErr
     *
     * brief
     *
     */
    nwkKeyErr() {
        if(this.nwkKeyFormCtrl.hasError('required')) {
            return 'You must enter a value';
        }
        if(this.nwkKeyFormCtrl.hasError('maxlength')) {
            return 'nwk key must have 16 chars';
        }
        if(this.nwkKeyFormCtrl.hasError('minlength')) {
            return 'nwk key must have 16 chars';
        }
    }

    /***********************************************************************************************
     * fn          panIdErr
     *
     * brief
     *
     */
    panIdErr() {

        if(this.panIdFormCtrl.hasError('required')) {
            return 'You must enter a value';
        }
        if(this.panIdFormCtrl.hasError('min')) {
            return `id must be ${this.minId} - ${this.maxId}`;
        }
        if(this.panIdFormCtrl.hasError('max')) {
            return `id must be ${this.minId} - ${this.maxId}`;
        }
    }

    /***********************************************************************************************
     * fn          panIdErr
     *
     * brief
     *
     */
    nwkChErr() {

        if(this.nwkChFormCtrl.hasError('required')) {
            return 'You must enter a value';
        }
        if(this.nwkChFormCtrl.hasError('min')) {
            return `ch must be ${this.minCh} - ${this.maxCh}`;
        }
        if(this.nwkChFormCtrl.hasError('max')) {
            return `ch must be ${this.minCh} - ${this.maxCh}`;
        }
    }

    /***********************************************************************************************
     * fn          openSerial
     *
     * brief
     *
     */
    openSerial() {
        this.serial.listComPorts();
    }

    /***********************************************************************************************
     * fn          closeSerial
     *
     * brief
     *
     */
    closeSerial() {
        this.serial.closeComPort();
        this.startFlag = true;
    }

    /***********************************************************************************************
     * fn          wrKeys
     *
     * brief
     *
     */
    wrKeys() {
        this.serial.wrKeys(this.nwkKeyFormCtrl.value,
                           this.panIdFormCtrl.value,
                           this.nwkChFormCtrl.value);
    }

    /***********************************************************************************************
     * fn          clearLogs
     *
     * brief
     *
     */
    clearLogs() {
        this.logs = [];
    }

    /***********************************************************************************************
     * fn          clearLogs
     *
     * brief
     *
     */
    isSecValid() {
        if(this.nwkKeyFormCtrl.invalid){
            return false;
        }
        if(this.panIdFormCtrl.invalid){
            return false;
        }
        if(this.nwkChFormCtrl.invalid){
            return false;
        }
        return true;
    }
}

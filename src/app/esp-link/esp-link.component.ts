import { Component, OnDestroy, OnInit, NgZone, ApplicationRef } from '@angular/core';
import { SerialService } from '../serial.service';
import { EventsService } from '../events.service';
import { GlobalsService } from '../globals.service';
import { Validators, FormGroup, FormControl } from '@angular/forms';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-esp-link',
    templateUrl: './esp-link.component.html',
    styleUrls: ['./esp-link.component.scss'],
})
export class Esp_Link_Component implements OnInit, OnDestroy {

    //minInt = 10;
    //maxInt = 60;

    ssidFormCtrl: FormControl;
    pswFormCtrl: FormControl;
    //repIntFormCtrl: FormControl;
    subscription = new Subscription;

    constructor(private serial: SerialService,
                private events: EventsService,
                private globals: GlobalsService,
                private ngZone: NgZone,
                private appRef: ApplicationRef) {
        //---
    }

    /***********************************************************************************************
     * fn          ngOnDestroy
     *
     * brief
     *
     */
    ngOnDestroy(): void {
        this.subscription.unsubscribe();
    }

    /***********************************************************************************************
     * fn          ngOnInit
     *
     * brief
     *
     */
    ngOnInit(): void {

        this.events.subscribe('rdNodeDataRsp', (msg: Uint8Array)=>{
            let buf = msg.buffer;
            let data = new DataView(buf);
            let idx = 0;

            let partNum = data.getUint32(idx, this.globals.LE);
            idx += 4;
            if(partNum == this.globals.ESP_LINK) {
                let chrCode = 0;
                let ssid = '';
                for(let i = 0; i < 32; i++) {
                    chrCode = data.getUint8(idx++);
                    if(chrCode != 0) {
                        ssid += String.fromCharCode(chrCode);
                    }
                }
                this.ssidFormCtrl.setValue(ssid);
                let psw = '';
                for(let i = 0; i < 16; i++) {
                    chrCode = data.getUint8(idx++);
                    if(chrCode != 0) {
                        psw += String.fromCharCode(chrCode);
                    }
                }
                this.pswFormCtrl.setValue(psw);
                //this.repIntFormCtrl.setValue(data.getUint8(idx++));
            }
        });
        this.events.subscribe('rdNodeData_0', ()=>{
            this.rdNodeData_0();
        });

        this.ssidFormCtrl = new FormControl(
            'home-iot',
            [
                Validators.required,
                Validators.maxLength(32),
            ]
        )
        const ssidSubscription = this.ssidFormCtrl.valueChanges.subscribe((ssid)=>{
            this.ssidFormCtrl.markAsTouched();
        });
        this.subscription.add(ssidSubscription);

        this.pswFormCtrl = new FormControl(
            'psw-1234',
            [
                Validators.required,
                Validators.maxLength(16),
            ]
        )
        const pswSubscription = this.pswFormCtrl.valueChanges.subscribe((psw)=>{
            this.pswFormCtrl.markAsTouched();
        });
        this.subscription.add(pswSubscription);
        /*
        this.repIntFormCtrl = new FormControl(
            this.minInt,
            [
                Validators.required,
                Validators.min(this.minInt),
                Validators.max(this.maxInt),
            ]
        );
        const repIntSubscription = this.repIntFormCtrl.valueChanges.subscribe((newInt)=>{
            this.repIntFormCtrl.markAsTouched();
            this.appRef.tick();
        });
        this.subscription.add(repIntSubscription);
        */
    }

    /***********************************************************************************************
     * fn          rdNodeData_0
     *
     * brief
     *
     */
    rdNodeData_0() {

        this.ngZone.run(()=>{
            this.ssidFormCtrl.setValue('------');
            this.pswFormCtrl.setValue('------');
            //this.repIntFormCtrl.setValue(this.minInt);
        });

        setTimeout(()=>{
            this.serial.rdNodeData_0();
        }, 200);
    }

    /***********************************************************************************************
     * fn          wrNodeData_0
     *
     * brief
     *
     */
    wrNodeData_0() {
        let buf = new ArrayBuffer(4 + 32 + 16 + 1);
        let data = new DataView(buf);
        let idx = 0;

        data.setUint32(idx, this.globals.ESP_LINK, this.globals.LE);
        idx += 4;
        for(let i = 0; i < 32; i++) {
            let chrCode = this.ssidFormCtrl.value.charCodeAt(i);
            if(chrCode) {
                data.setUint8(idx++, chrCode);
            }
            else {
                data.setUint8(idx++, 0);
            }
        }
        for(let i = 0; i < 16; i++) {
            let chrCode = this.pswFormCtrl.value.charCodeAt(i);
            if(chrCode) {
                data.setUint8(idx++, chrCode);
            }
            else {
                data.setUint8(idx++, 0);
            }
        }
        //data.setUint8(idx++, this.repIntFormCtrl.value);

        this.serial.wrNodeData_0(buf);
    }

    /***********************************************************************************************
     * fn          ssidErr
     *
     * brief
     *
     */
    ssidErr() {
        if(this.ssidFormCtrl.hasError('required')) {
            return 'You must enter a value';
        }

        if(this.ssidFormCtrl.hasError('maxlength')) {
            return 'ssid must have max 32 chars';
        }
        /*
        if(this.ssidFormCtrl.hasError('minlength')) {
            return 'link key must have 16 chars';
        }
        */
    }

    /***********************************************************************************************
     * fn          pswErr
     *
     * brief
     *
     */
    pswErr() {
        if(this.pswFormCtrl.hasError('required')) {
            return 'You must enter a value';
        }
        if(this.pswFormCtrl.hasError('maxlength')) {
            return 'psw must have max 16 chars';
        }
        /*
        if(this.pswFormCtrl.hasError('minlength')) {
            return 'link key must have 16 chars';
        }
        */
    }

    /***********************************************************************************************
     * fn          repIntErr
     *
     * brief
     *
     */
    repIntErr() {
        /*
        if(this.repIntFormCtrl.hasError('required')) {
            return 'You must enter a value';
        }
        */
        /*
        if(this.repIntFormCtrl.hasError('min')) {
            return `rep interval must be ${this.minInt} - ${this.maxInt}`;
        }
        if(this.repIntFormCtrl.hasError('max')) {
            return `rep interval must be ${this.minInt} - ${this.maxInt}`;
        }
        */
    }

    /***********************************************************************************************
     * fn          isInvalid
     *
     * brief
     *
     */
    isInvalid() {
        if(this.ssidFormCtrl.invalid || this.pswFormCtrl.invalid){
            return true;
        }
        return false;
    }

}

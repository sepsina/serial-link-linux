import { Component, OnInit, NgZone, OnDestroy, ApplicationRef } from '@angular/core';
import { SerialService } from '../serial.service';
import { EventsService } from '../events.service';
import { GlobalsService } from '../globals.service';
import { Validators, FormGroup, FormControl } from '@angular/forms';
import { Subscription } from 'rxjs';
import * as gIF from '../gIF';

@Component({
    selector: 'app-dbl-sw-008',
    templateUrl: './dbl-sw-008.component.html',
    styleUrls: ['./dbl-sw-008.component.scss'],
})
export class DBL_SW_008_Component implements OnInit, OnDestroy {

    minInt = 1;
    maxInt = 10;

    batVoltFlag = false;
    repIntFormCtrl: FormControl;
    subscription = new Subscription();

    rwBuf = new gIF.rwBuf_t();

    constructor(private serial: SerialService,
                private events: EventsService,
                private globals: GlobalsService,
                private ngZone: NgZone,
                private appRef: ApplicationRef) {
        //---
    }

    ngOnDestroy(): void {
        this.subscription.unsubscribe();
    }

    ngOnInit(): void {

        this.events.subscribe('rdNodeDataRsp', (msg)=>{
            this.rwBuf.rdBuf = msg;
            this.rwBuf.rdIdx = 0;
            const partNum = this.rwBuf.read_uint32_LE();
            if(partNum == this.globals.DBL_SW_008) {
                this.ngZone.run(()=>{
                    this.batVoltFlag = !!this.rwBuf.read_uint8();
                    this.repIntFormCtrl.setValue(this.rwBuf.read_uint8());
                })
            }
        });
        this.events.subscribe('rdNodeData_0', ()=>{
            this.rdNodeData_0();
        });

        this.repIntFormCtrl = new FormControl(
            this.minInt,
            [
                Validators.required,
                Validators.min(this.minInt),
                Validators.max(this.maxInt),
            ]
        );
        this.repIntFormCtrl.markAsTouched();
        const repIntSubscription = this.repIntFormCtrl.valueChanges.subscribe((newInt)=>{
            this.appRef.tick();
        });
        this.subscription.add(repIntSubscription);
    }

    /***********************************************************************************************
     * fn          rdNodeData_0
     *
     * brief
     *
     */
    rdNodeData_0() {

        this.ngZone.run(()=>{
            this.batVoltFlag = !this.batVoltFlag;
            this.repIntFormCtrl.setValue(this.minInt);
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

        let buf = new ArrayBuffer(6);
        let data = new DataView(buf);
        let idx = 0;

        data.setUint32(idx, this.globals.DBL_SW_008, this.globals.LE);
        idx += 4;
        data.setUint8(idx++, this.batVoltFlag ? 1 : 0);
        data.setUint8(idx++, this.repIntFormCtrl.value);

        this.serial.wrNodeData_0(buf);
    }

    /***********************************************************************************************
     * fn          repIntErr
     *
     * brief
     *
     */
    repIntErr() {
        if(this.repIntFormCtrl.hasError('required')) {
            return 'You must enter a value';
        }
        if(this.repIntFormCtrl.hasError('min')) {
            return `report interval must be ${this.minInt} - ${this.maxInt}`;
        }
        if(this.repIntFormCtrl.hasError('max')) {
            return `report interval must be ${this.minInt} - ${this.maxInt}`;
        }
    }

    /***********************************************************************************************
     * fn          batVoltFlagChange
     *
     * brief
     *
     */
     batVoltFlagChange(flag) {
        this.ngZone.run(()=>{
            this.batVoltFlag = flag;
        });
    }

    /***********************************************************************************************
     * fn          isInvalid
     *
     * brief
     *
     */
     isInvalid() {
        if(this.repIntFormCtrl.invalid){
            return true;
        }
        return false;
    }
}

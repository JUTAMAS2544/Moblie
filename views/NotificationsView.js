import React, { useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ScrollView, ActivityIndicator } from 'react-native';
import db from '../database/firebaseDB';
import { collection, query, getDocs, updateDoc, doc, orderBy, getDoc} from "firebase/firestore";
import { Cache } from 'react-native-cache'; // cache
import AsyncStorage from '@react-native-async-storage/async-storage'; // cache storage
import { AntDesign } from '@expo/vector-icons'; // Icon
import { HeaderButtons, Item } from "react-navigation-header-buttons"; // header button
import CustomHeaderButton from '../components/CustomHeaderButton'; // header button
import { useFocusEffect } from '@react-navigation/native';

function CheckFocusScreen(props) {
  useFocusEffect(
    useCallback(() => {
      props.refresh()
      props.GetData();
      props.Check();
      return () => {
        props.reset();
      };
    }, [])
  );
  return <View />;
}

export default class NotificationsView extends React.Component{
  constructor() {
    super();
    this.state = {
      data: [],
      AllNoti: [],
      refresh: false
    }
    this.GetData = this.GetData.bind(this);
    this.CheckIgnoreRisk = this.CheckIgnoreRisk.bind(this)
    this.updateLike = this.updateLike.bind(this)
  }

  componentDidMount(){
    // ตั้งค่า cache
    this.cache = new Cache({
      namespace: "RANS",
      policy: {
        maxEntries: 50000, // if unspecified, it can have unlimited entries
        stdTTL: 0 // the standard ttl as number in seconds, default: 0 (unlimited)
      },
      backend: AsyncStorage
    });
    const { navigation } = this.props;
    navigation.setOptions({
      headerRight:()=>(
        <HeaderButtons HeaderButtonComponent={CustomHeaderButton}>
          <Item title='remove' iconName='trash-outline' onPress={()=>{
            this.setState({
              AllNoti: []
            })
            this.removeAll()
          }}/>
        </HeaderButtons>
      )
    });
  }

  componentWillUnmount(){
    this.setState({
      AllNoti: [],
      data: [],
      refresh: false
    })
  }

  async removeAll () {
    await this.cache.remove('ignoreID')
  }

  async GetData () {
    const q = query(collection(db, "rans-database"), orderBy("_id", "asc"));
    const querySnapshot = await getDocs(q);
    const d = querySnapshot.docs.map((d) => ({ key: d.id, ...d.data() }));
    const ignoreID = await this.cache.get('ignoreID')
    const sortList = []
    if(ignoreID!=undefined){
      ignoreID.map((item)=>{
        d.map((DBitem)=>{
          if(item==DBitem.key){
            sortList.push(DBitem)
          }
        })
      })
    }
    this.setState({
      AllNoti: sortList,
      data: d,
      refresh: false
    })
  }

  async CheckIgnoreRisk () {
    const ignoreID = await this.cache.get('ignoreID')
    let likeCache = await this.cache.get('like')
    let disLikeCache = await this.cache.get('dislike')
    if(likeCache == undefined){
      likeCache = []
    }
    if(disLikeCache == undefined){
      disLikeCache = []
    }
    if(ignoreID != undefined){
      ignoreID.map((item, index)=>{
        if(likeCache.indexOf(item)>=0 || disLikeCache.indexOf(item)>=0){
          ignoreID.splice(index, 1)
        }
      })
      await this.cache.set('ignoreID', ignoreID)
    }
  }

  // อัปเดตข้อมูลการถูกใจใน Firebase Database
  async updateLike(key) {
    const q = doc(db, "rans-database", key); // หาตัวที่ ID ตรงกับ Parameter
    const querySnapshot = await getDoc(q);
    const likeData = {key: querySnapshot.id, ...querySnapshot.data()};
    let likeCache = await this.cache.get('like'); // ไม่ใช้ State เพื่อให้อัปเดตง่าย
    if(likeCache==undefined){
      likeCache = []
    }
    likeCache.push(key)
    await updateDoc(doc(db, "rans-database", key), {
      like: likeData.like+1
    }).then(
      console.log("Like Updated")
    )
    await this.cache.set('like', likeCache) // Update Cache
  }

  async updateDislike(key) {
    const q = doc(db, "rans-database", key); // หาตัวที่ ID ตรงกับ Parameter
    const querySnapshot = await getDoc(q);
    const dislikeData = {key: querySnapshot.id, ...querySnapshot.data()};
    let disLikeCache = await this.cache.get('dislike');
    if(disLikeCache==undefined){
      disLikeCache = []
    }
    disLikeCache.push(key)
    await updateDoc(doc(db, "rans-database", key), {
      dislike: dislikeData.like+1
    }).then(
      console.log("Dislike Updated")
    )
    await this.cache.set('dislike', disLikeCache)
  }
  
  async likeHandle (key, index) {
    this.updateLike(key)
    this.notiList = this.state.AllNoti
    this.notiList.splice(index, 1)
    this.notiCache = await this.cache.get('ignoreID')
    this.notiCache.splice(index, 1)
    await this.cache.set('ignoreID', this.notiCache)
    this.setState({
      AllNoti: this.notiList
    })
    this.CheckIgnoreRisk()
  }

  async dislikeHandle (key, index) {
    this.updateDislike(key)
    this.notiList = this.state.AllNoti
    this.notiList.splice(index, 1)
    this.notiCache = await this.cache.get('ignoreID')
    this.notiCache.splice(index, 1)
    await this.cache.set('ignoreID', this.notiCache)
    this.setState({
      AllNoti: this.notiList
    })
    this.CheckIgnoreRisk()
  }

  render(){
    return(
      <ScrollView style={styles.container} contentContainerStyle={!this.state.refresh?(this.state.AllNoti.length>0 && this.state.AllNoti!=undefined)?null:{ flexGrow: 1, justifyContent: 'center' }:{ flexGrow: 1, justifyContent: 'center' }}>
      <CheckFocusScreen GetData={this.GetData} Check={this.CheckIgnoreRisk} refresh={()=>{this.setState({refresh:true})}} reset={()=>{this.setState({AllNoti:[],data:[],refresh:false})}}/>
      {!this.state.refresh?(this.state.AllNoti.length>0 && this.state.AllNoti!=undefined)?
      this.state.AllNoti.map((item, index)=>(
        <View style={styles.notiContainer} key={index}>
          <Text style={styles.notiTitle}>{item.รายละเอียด}</Text>
          <View style={styles.notiButtonContainer} >
            <TouchableOpacity style={[styles.notiButton, styles.greenButton]} onPress={()=>{this.likeHandle(item.key, index)}}>
              <AntDesign name="like1" size={24} color={'black'} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.notiButton, styles.redButton]} onPress={()=>{this.dislikeHandle(item.key, index)}}>
              <AntDesign name="dislike1" size={24} color={'black'} />
            </TouchableOpacity>
          </View>
        </View>
      )):<Text style={{alignSelf:'center'}}>No Notification</Text>:<ActivityIndicator style={styles.loading} color={'green'} size={'large'}/>}
    </ScrollView>
  );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  loading: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center'
  },
  notiContainer: {
    margin: 10,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 10,
    backgroundColor: "#FFF",
  },
  notiTitle: {
    fontWeight: 'bold',
    margin: 10
  },
  notiButtonContainer: {
    flexDirection: 'row',
    alignSelf: 'center'
  },
  notiButton: {
    flex: 1,
    padding: 10,
    margin: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    borderRadius: 5,
    backgroundColor: "#fff",
    alignItems: 'center'
  },
  redButton: {
    backgroundColor: '#F36C6C'
  },
  greenButton: {
    backgroundColor: "#6BF38B"
  }
});
